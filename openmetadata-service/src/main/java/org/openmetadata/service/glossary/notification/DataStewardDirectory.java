/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.notification;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;

/**
 * Users holding the {@code DATA_STEWARD} role directly or as a default role of one of their teams
 * or ancestor teams, the same inheritance {@code SubjectContext.hasAnyRole} applies.
 */
@Slf4j
final class DataStewardDirectory {
  static final String DATA_STEWARD_ROLE = "DATA_STEWARD";

  private DataStewardDirectory() {}

  /** Active, non-bot data stewards other than {@code excludedUser}. */
  static List<EntityReference> stewardsExcept(String excludedUser) {
    return candidateUserIds().stream()
        .map(DataStewardDirectory::activeHuman)
        .filter(Objects::nonNull)
        .filter(user -> !user.getName().equals(excludedUser))
        .map(user -> new EntityReference().withId(user.getId()).withType(Entity.USER))
        .toList();
  }

  private static Set<UUID> candidateUserIds() {
    final Set<UUID> result = new LinkedHashSet<>();
    final UUID roleId = stewardRoleId();
    if (roleId != null) {
      final EntityRelationshipDAO relationships = Entity.getCollectionDAO().relationshipDAO();
      ids(relationships.findFrom(roleId, Entity.ROLE, Relationship.HAS.ordinal(), Entity.USER))
          .forEach(result::add);
      teamsInheriting(relationships, roleId)
          .forEach(
              teamId ->
                  ids(relationships.findTo(
                          teamId, Entity.TEAM, Relationship.HAS.ordinal(), Entity.USER))
                      .forEach(result::add));
    }
    return result;
  }

  private static UUID stewardRoleId() {
    UUID result = null;
    try {
      final Role role =
          Entity.getEntityByName(Entity.ROLE, DATA_STEWARD_ROLE, "", Include.NON_DELETED);
      result = role.getId();
    } catch (EntityNotFoundException exception) {
      LOG.warn("Role {} does not exist; no data steward can be notified", DATA_STEWARD_ROLE);
    }
    return result;
  }

  /** Teams holding the role as a default role, plus all their descendant teams. */
  private static Set<UUID> teamsInheriting(EntityRelationshipDAO relationships, UUID roleId) {
    final Set<UUID> visited = new HashSet<>();
    final Deque<UUID> pending =
        new ArrayDeque<>(
            ids(
                relationships.findFrom(
                    roleId, Entity.ROLE, Relationship.HAS.ordinal(), Entity.TEAM)));
    while (!pending.isEmpty()) {
      final UUID teamId = pending.pop();
      if (visited.add(teamId)) {
        pending.addAll(
            ids(
                relationships.findTo(
                    teamId, Entity.TEAM, Relationship.PARENT_OF.ordinal(), Entity.TEAM)));
      }
    }
    return visited;
  }

  private static List<UUID> ids(List<EntityRelationshipRecord> records) {
    return records.stream().map(EntityRelationshipRecord::getId).toList();
  }

  private static User activeHuman(UUID userId) {
    User result = null;
    try {
      final User user = Entity.getEntity(Entity.USER, userId, "", Include.NON_DELETED);
      result = Boolean.TRUE.equals(user.getIsBot()) ? null : user;
    } catch (EntityNotFoundException exception) {
      LOG.debug("Skipping deleted data steward {}", userId);
    }
    return result;
  }
}
