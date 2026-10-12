/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.dq.DqResultService.RuleState;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.RuleExecRow;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;

/**
 * The Rules of a Domain. A Rule belongs to a Domain when the newest published version of the Rule,
 * or of its CDE, is assigned to the Domain or to one of its subdomains; drafts do not move a Rule.
 * The evaluated Rules are kept for a short time, since a page of the Domain reads them for its
 * results and its trend, and again on each filter or page change.
 */
final class DqDomainScope {
  private static final int CACHE_SECONDS = 15;
  private static final int CACHE_SIZE = 20;
  private static final Cache<String, List<RuleState>> RULE_STATES =
      Caffeine.newBuilder()
          .maximumSize(CACHE_SIZE)
          .expireAfterWrite(Duration.ofSeconds(CACHE_SECONDS))
          .build();

  private DqDomainScope() {}

  static List<RuleState> ruleStates(String domainId) {
    return RULE_STATES.get(domainId, DqDomainScope::loadRuleStates);
  }

  private static List<RuleState> loadRuleStates(String domainId) {
    final String domainFqn = domainFqn(domainId);
    final Map<String, Boolean> cdeInDomain = new HashMap<>();
    final List<RuleState> states = new ArrayList<>();
    for (RuleExecRow row : DqResultService.dao().listRuleExec()) {
      if (isInDomain(row, domainFqn, cdeInDomain)) {
        states.add(DqResultService.load(row.ruleTermId()));
      }
    }
    return List.copyOf(states);
  }

  private static String domainFqn(String domainId) {
    final Domain domain =
        Entity.getEntity(Entity.DOMAIN, UUID.fromString(domainId), "", Include.NON_DELETED);
    return domain.getFullyQualifiedName();
  }

  private static boolean isInDomain(
      RuleExecRow row, String domainFqn, Map<String, Boolean> cdeInDomain) {
    return isPublishedInDomain(row.ruleTermId(), domainFqn)
        || (row.cdeTermId() != null
            && cdeInDomain.computeIfAbsent(
                row.cdeTermId(), cdeId -> isPublishedInDomain(cdeId, domainFqn)));
  }

  private static boolean isPublishedInDomain(String termId, String domainFqn) {
    return Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .listPublished(Entity.GLOSSARY_TERM, UUID.fromString(termId))
        .stream()
        .max(Comparator.comparingLong(PublishedSnapshotRecord::publicationSequence))
        .map(snapshot -> JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class))
        .map(term -> isAssigned(term.getDomains(), domainFqn))
        .orElse(false);
  }

  static boolean isAssigned(List<EntityReference> domains, String domainFqn) {
    return !nullOrEmpty(domains)
        && domains.stream()
            .map(EntityReference::getFullyQualifiedName)
            .filter(Objects::nonNull)
            .anyMatch(fqn -> isSameOrSubdomain(fqn, domainFqn));
  }

  private static boolean isSameOrSubdomain(String fqn, String domainFqn) {
    return fqn.equals(domainFqn) || fqn.startsWith(domainFqn + Entity.SEPARATOR);
  }
}
