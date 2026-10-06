/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.UUID;

/** One data steward of a record: a team or a user. */
public record TechnicalOwnerRef(UUID id, String type) {
  public static final String TEAM = "team";
  public static final String USER = "user";

  public String entityType() {
    return USER.equals(type) ? "user" : "team";
  }
}
