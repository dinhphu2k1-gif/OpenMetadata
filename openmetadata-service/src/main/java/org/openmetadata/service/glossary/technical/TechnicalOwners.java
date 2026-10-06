/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Stores the data stewards of a record in the single {@code systemOwnerId} column as a JSON array.
 * A bare UUID, written before several stewards were allowed, reads as one team.
 */
public final class TechnicalOwners {
  private TechnicalOwners() {}

  /** The stewards held by a stored column value; never null. */
  public static List<TechnicalOwnerRef> parse(String stored) {
    final String value = stored == null ? "" : stored.trim();
    final List<TechnicalOwnerRef> owners;
    if (value.isEmpty()) {
      owners = List.of();
    } else if (value.startsWith("[")) {
      owners = JsonUtils.readValue(value, new TypeReference<List<TechnicalOwnerRef>>() {});
    } else {
      owners = List.of(new TechnicalOwnerRef(UUID.fromString(value), TechnicalOwnerRef.TEAM));
    }
    return normalize(owners);
  }

  /** The column value for the stewards, or null when there are none. */
  public static String serialize(List<TechnicalOwnerRef> owners) {
    final List<TechnicalOwnerRef> normalized = normalize(owners);
    return normalized.isEmpty() ? null : JsonUtils.pojoToJson(normalized);
  }

  /** Drops empty and repeated references and fixes the order, so equal sets compare equal. */
  public static List<TechnicalOwnerRef> normalize(List<TechnicalOwnerRef> owners) {
    final LinkedHashSet<TechnicalOwnerRef> unique = new LinkedHashSet<>();
    if (owners != null) {
      owners.stream()
          .filter(owner -> owner != null && owner.id() != null)
          .map(owner -> new TechnicalOwnerRef(owner.id(), owner.entityType()))
          .forEach(unique::add);
    }
    return List.copyOf(unique);
  }
}
