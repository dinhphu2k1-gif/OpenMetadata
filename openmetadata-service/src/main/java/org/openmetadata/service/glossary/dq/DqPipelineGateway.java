/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

/**
 * The per-Rule logical TestSuite and its pipeline. Every Rule has one suite holding all its
 * testcases and one TestSuite pipeline; the schedule belongs to the Rule and a run covers every
 * testcase of the suite on every Table.
 */
@Slf4j
public final class DqPipelineGateway {
  public static final String PIPELINE_NAME = "DQR_pipeline";
  private static final Object CLIENT_LOCK = new Object();
  private static PipelineServiceClientInterface client;

  private DqPipelineGateway() {}

  public static TestSuite ensureSuite(DqRuleContext rule) {
    final TestSuite wanted =
        new TestSuiteMapper()
            .createToEntity(
                new CreateTestSuite()
                    .withName(rule.testSuiteName())
                    .withDisplayName(rule.code() + " · " + rule.displayName())
                    .withDescription(rule.description()),
                DqManagedWrite.ACTOR)
            .withBasic(false);
    DqManagedWrite.run(() -> suites().createOrUpdate(null, wanted, DqManagedWrite.ACTOR));
    return suites().findByNameOrNull(rule.testSuiteName(), Include.NON_DELETED);
  }

  public static void addTestCases(TestSuite suite, List<UUID> testCaseIds) {
    if (!nullOrEmpty(testCaseIds)) {
      DqManagedWrite.run(
          () ->
              ((TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE))
                  .addTestCasesToLogicalTestSuite(suite, testCaseIds));
    }
  }

  /** Creates the pipeline of the suite if it is missing and deploys it with the Rule's schedule. */
  public static IngestionPipeline ensurePipeline(TestSuite suite, String cron) {
    final String fqn = suite.getFullyQualifiedName() + "." + PIPELINE_NAME;
    IngestionPipeline pipeline = pipelines().findByNameOrNull(fqn, Include.NON_DELETED);
    if (pipeline == null) {
      pipeline = createPipeline(suite, cron);
    } else if (!sameSchedule(pipeline, cron)) {
      pipeline = applySchedule(pipeline, cron);
    }
    return pipeline;
  }

  public static IngestionPipeline applySchedule(IngestionPipeline pipeline, String cron) {
    pipeline.getAirflowConfig().setScheduleInterval(cron);
    final IngestionPipeline saved = save(pipeline);
    deploy(saved);
    return saved;
  }

  public static IngestionPipeline find(String pipelineId) {
    return pipelineId == null
        ? null
        : pipelines().find(UUID.fromString(pipelineId), Include.NON_DELETED);
  }

  /** Enables or disables the pipeline in the pipeline service; does nothing if already in state. */
  public static void setEnabled(IngestionPipeline pipeline, boolean enabled) {
    final boolean current = !Boolean.FALSE.equals(pipeline.getEnabled());
    final PipelineServiceClientInterface service = pipelineClient();
    if (current != enabled && service != null) {
      prepare(pipeline);
      service.toggleIngestion(pipeline);
      save(pipeline);
    }
  }

  public static PipelineServiceClientResponse trigger(IngestionPipeline pipeline) {
    final PipelineServiceClientInterface service = pipelineClient();
    PipelineServiceClientResponse response =
        new PipelineServiceClientResponse().withCode(200).withReason("Pipeline Client Disabled");
    if (service != null) {
      prepare(pipeline);
      response = service.runPipeline(pipeline, serviceOf(pipeline));
    }
    return response;
  }

  public static PipelineStatus latestStatus(IngestionPipeline pipeline) {
    return pipelines().getLatestPipelineStatus(pipeline);
  }

  private static IngestionPipeline createPipeline(TestSuite suite, String cron) {
    final CreateIngestionPipeline create =
        new CreateIngestionPipeline()
            .withName(PIPELINE_NAME)
            .withDisplayName(suite.getDisplayName())
            .withPipelineType(PipelineType.TEST_SUITE)
            .withService(suite.getEntityReference())
            .withLoggerLevel(LogLevels.INFO)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new TestSuitePipeline()
                            .withType(TestSuitePipeline.TestSuiteConfigType.TEST_SUITE)
                            .withEntityFullyQualifiedName(suite.getFullyQualifiedName())))
            .withAirflowConfig(new AirflowConfig().withScheduleInterval(cron));
    final IngestionPipeline pipeline =
        new IngestionPipelineMapper(DqTestBootstrap.config())
            .createToEntity(create, DqManagedWrite.ACTOR);
    final IngestionPipeline saved = save(pipeline);
    deploy(saved);
    return saved;
  }

  private static boolean sameSchedule(IngestionPipeline pipeline, String cron) {
    final String current =
        pipeline.getAirflowConfig() == null
            ? null
            : pipeline.getAirflowConfig().getScheduleInterval();
    return java.util.Objects.equals(
        nullOrEmpty(current) ? null : current, nullOrEmpty(cron) ? null : cron);
  }

  private static IngestionPipeline save(IngestionPipeline pipeline) {
    DqManagedWrite.run(() -> pipelines().createOrUpdate(null, pipeline, DqManagedWrite.ACTOR));
    return pipelines().findByNameOrNull(pipeline.getFullyQualifiedName(), Include.NON_DELETED);
  }

  private static void deploy(IngestionPipeline pipeline) {
    final PipelineServiceClientInterface service = pipelineClient();
    if (service != null) {
      prepare(pipeline);
      final PipelineServiceClientResponse response =
          service.deployPipeline(pipeline, serviceOf(pipeline));
      if (response.getCode() != 200) {
        throw new IllegalStateException(
            "Pipeline "
                + pipeline.getFullyQualifiedName()
                + " was not deployed: "
                + response.getReason());
      }
    } else {
      LOG.info(
          "Pipeline client is disabled; pipeline {} is not deployed",
          pipeline.getFullyQualifiedName());
    }
  }

  /** Decrypts secrets and attaches the server connection, as the pipeline resource does. */
  private static void prepare(IngestionPipeline pipeline) {
    final SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    secretsManager.decryptIngestionPipeline(pipeline);
    final OpenMetadataConnection connection =
        new OpenMetadataConnectionBuilder(DqTestBootstrap.config(), pipeline).build();
    pipeline.setOpenMetadataServerConnection(
        secretsManager.encryptOpenMetadataConnection(connection, false));
  }

  private static ServiceEntityInterface serviceOf(IngestionPipeline pipeline) {
    return Entity.getEntity(pipeline.getService(), "ingestionRunner", Include.NON_DELETED);
  }

  private static PipelineServiceClientInterface pipelineClient() {
    synchronized (CLIENT_LOCK) {
      if (client == null) {
        client =
            PipelineServiceClientFactory.createPipelineServiceClient(
                DqTestBootstrap.config().getPipelineServiceClientConfiguration());
      }
      return client;
    }
  }

  private static TestSuiteRepository suites() {
    return (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
  }

  private static IngestionPipelineRepository pipelines() {
    return (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
  }
}
