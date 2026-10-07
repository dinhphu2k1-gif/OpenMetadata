/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashSet;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.resources.dqtests.TestSuiteMapper;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

/**
 * The per-Rule logical TestSuite and the pipelines of its declarations. Every Rule has one suite
 * holding all its testcases; every declaration has its own TestSuite pipeline, with the declaration's
 * schedule, that runs only the testcases of that declaration on every Table.
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
    suites().prepareInternal(wanted, false);
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

  /** Creates the pipeline of a declaration if it is missing and deploys it with the declaration's schedule. */
  public static IngestionPipeline ensureSpecPipeline(
      TestSuite suite, String specKey, List<String> testCaseNames, String cron) {
    final String fqn = specPipelineFqn(suite.getFullyQualifiedName(), specKey);
    IngestionPipeline pipeline = pipelines().findByNameOrNull(fqn, Include.NON_DELETED);
    if (pipeline == null) {
      pipeline = createPipeline(suite, specKey, testCaseNames, cron);
    } else if (!sameSchedule(pipeline, cron) || !sameTestCases(pipeline, testCaseNames)) {
      pipeline = updatePipeline(pipeline, suite, testCaseNames, cron);
    }
    return pipeline;
  }

  public static IngestionPipeline findSpecPipeline(String suiteFqn, String specKey) {
    return pipelines().findByNameOrNull(specPipelineFqn(suiteFqn, specKey), Include.NON_DELETED);
  }

  /** The pipelines of the given declarations of a suite; a declaration without one is skipped. */
  public static List<IngestionPipeline> findSpecPipelines(String suiteId, List<String> specKeys) {
    final List<IngestionPipeline> found = new ArrayList<>();
    if (suiteId != null) {
      final TestSuite suite = suites().find(UUID.fromString(suiteId), Include.NON_DELETED);
      for (String specKey : specKeys) {
        final IngestionPipeline pipeline = findSpecPipeline(suite.getFullyQualifiedName(), specKey);
        if (pipeline != null) {
          found.add(pipeline);
        }
      }
    }
    return found;
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

  /**
   * Applies what a user changed on the Portal to the pipeline service, which the Portal cannot
   * reach: deploys the pipeline with its schedule and sets it enabled or disabled. A pipeline that
   * no longer exists is removed from the pipeline service.
   */
  public static void syncIngestionPipeline(String pipelineId, String pipelineName) {
    final PipelineServiceClientInterface service = pipelineClient();
    if (service == null) {
      LOG.info("Pipeline client is disabled; pipeline {} is not synced", pipelineId);
      return;
    }
    final IngestionPipeline pipeline = findOrNull(pipelineId);
    if (pipeline == null) {
      if (!nullOrEmpty(pipelineName)) {
        service.deletePipeline(new IngestionPipeline().withName(pipelineName));
      }
      return;
    }
    final boolean wasDeployed = Boolean.TRUE.equals(pipeline.getDeployed());
    final boolean enabled = !Boolean.FALSE.equals(pipeline.getEnabled());
    deploy(pipeline);
    markDeployed(pipelineId);
    // A new deployment starts enabled; an earlier one may have been switched off
    if (!enabled || wasDeployed) {
      applyEnabled(service, pipeline, enabled);
    }
  }

  /** Runs a pipeline that was requested on the Portal, deploying it first if it never was. */
  public static void triggerIngestionPipeline(String pipelineId) {
    if (pipelineClient() == null) {
      LOG.info("Pipeline client is disabled; pipeline {} is not triggered", pipelineId);
      return;
    }
    IngestionPipeline pipeline = findOrNull(pipelineId);
    if (pipeline != null) {
      if (!Boolean.TRUE.equals(pipeline.getDeployed())) {
        deploy(pipeline);
        markDeployed(pipelineId);
        pipeline = findOrNull(pipelineId);
      }
      final PipelineServiceClientResponse response = trigger(pipeline);
      if (!Integer.valueOf(200).equals(response.getCode())) {
        throw new IllegalStateException(
            "Pipeline "
                + pipeline.getFullyQualifiedName()
                + " was not triggered: "
                + response.getReason());
      }
    }
  }

  private static void applyEnabled(
      PipelineServiceClientInterface service, IngestionPipeline pipeline, boolean enabled) {
    // The client switches to the opposite of the state it is given
    final IngestionPipeline probe =
        JsonUtils.deepCopy(pipeline, IngestionPipeline.class).withEnabled(!enabled);
    final PipelineServiceClientResponse response = service.toggleIngestion(probe);
    if (!Integer.valueOf(200).equals(response.getCode())) {
      throw new IllegalStateException(
          "Pipeline "
              + pipeline.getFullyQualifiedName()
              + " could not be set enabled="
              + enabled
              + ": "
              + response.getReason());
    }
  }

  private static void markDeployed(String pipelineId) {
    final IngestionPipeline pipeline = findOrNull(pipelineId);
    if (pipeline != null && !Boolean.TRUE.equals(pipeline.getDeployed())) {
      pipeline.setDeployed(true);
      pipelines().createOrUpdate(null, pipeline, pipeline.getUpdatedBy());
    }
  }

  private static IngestionPipeline findOrNull(String pipelineId) {
    try {
      return find(pipelineId);
    } catch (EntityNotFoundException e) {
      return null;
    }
  }

  public static PipelineStatus latestStatus(IngestionPipeline pipeline) {
    return pipelines().getLatestPipelineStatus(pipeline);
  }

  private static String specPipelineFqn(String suiteFqn, String specKey) {
    return suiteFqn + "." + PIPELINE_NAME + "_" + specKey;
  }

  private static IngestionPipeline createPipeline(
      TestSuite suite, String specKey, List<String> testCaseNames, String cron) {
    final CreateIngestionPipeline create =
        new CreateIngestionPipeline()
            .withName(PIPELINE_NAME + "_" + specKey)
            .withDisplayName(suite.getDisplayName())
            .withPipelineType(PipelineType.TEST_SUITE)
            .withService(suite.getEntityReference())
            .withLoggerLevel(LogLevels.INFO)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new TestSuitePipeline()
                            .withType(TestSuitePipeline.TestSuiteConfigType.TEST_SUITE)
                            .withEntityFullyQualifiedName(suite.getFullyQualifiedName())
                            .withTestCases(testCaseNames)))
            .withAirflowConfig(new AirflowConfig().withScheduleInterval(nullIfEmpty(cron)));
    final IngestionPipeline pipeline =
        new IngestionPipelineMapper(DqTestBootstrap.config())
            .createToEntity(create, DqManagedWrite.ACTOR);
    final IngestionPipeline saved = save(pipeline);
    deploy(saved);
    return saved;
  }

  private static IngestionPipeline updatePipeline(
      IngestionPipeline pipeline, TestSuite suite, List<String> testCaseNames, String cron) {
    // The service is a relationship, so a pipeline read without fields has none to validate
    pipeline.setService(suite.getEntityReference());
    final TestSuitePipeline config = testSuiteConfig(pipeline);
    config.setTestCases(testCaseNames);
    pipeline.getSourceConfig().setConfig(config);
    pipeline.getAirflowConfig().setScheduleInterval(nullIfEmpty(cron));
    final IngestionPipeline saved = save(pipeline);
    deploy(saved);
    return saved;
  }

  private static TestSuitePipeline testSuiteConfig(IngestionPipeline pipeline) {
    return JsonUtils.convertValue(pipeline.getSourceConfig().getConfig(), TestSuitePipeline.class);
  }

  private static boolean sameTestCases(IngestionPipeline pipeline, List<String> testCaseNames) {
    final List<String> current = testSuiteConfig(pipeline).getTestCases();
    return new HashSet<>(current == null ? List.of() : current)
        .equals(new HashSet<>(testCaseNames));
  }

  private static boolean sameSchedule(IngestionPipeline pipeline, String cron) {
    final String current =
        pipeline.getAirflowConfig() == null
            ? null
            : pipeline.getAirflowConfig().getScheduleInterval();
    return java.util.Objects.equals(nullIfEmpty(current), nullIfEmpty(cron));
  }

  private static String nullIfEmpty(String value) {
    return nullOrEmpty(value) ? null : value;
  }

  private static IngestionPipeline save(IngestionPipeline pipeline) {
    pipelines().prepareInternal(pipeline, false);
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
    if (pipeline.getService() == null) {
      // The service is a relationship, so a pipeline read without fields has none to send
      pipeline.setService(
          pipelines().get(null, pipeline.getId(), pipelines().getFields("owners")).getService());
    }
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
