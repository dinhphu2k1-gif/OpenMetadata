/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

/**
 * Runtime switch for governed glossary list reads. Off unless set to {@code true}: the database
 * read stays the default until the index has been verified against it in the target environment.
 */
public final class GovernedGlossarySearchSettings {
  public static final String ENVIRONMENT_KEY = "GOVERNED_GLOSSARY_SEARCH_READ_FROM_INDEX";
  public static final String PROPERTY_KEY = "governedGlossarySearch.readFromIndex";

  private GovernedGlossarySearchSettings() {}

  public static boolean readFromIndex() {
    final String property = System.getProperty(PROPERTY_KEY);
    final String configured = property == null ? System.getenv(ENVIRONMENT_KEY) : property;
    return Boolean.parseBoolean(configured);
  }
}
