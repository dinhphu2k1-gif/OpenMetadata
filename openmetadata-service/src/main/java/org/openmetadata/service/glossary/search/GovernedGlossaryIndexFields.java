/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

/** Stored and internal fields of the governed glossary flat index. */
public final class GovernedGlossaryIndexFields {
  public static final String BUSINESS_VERSION = "businessVersion";
  public static final String BUSINESS_VERSION_SORT = "businessVersionSort";
  public static final String CLASSIFICATION_TAGS = "classificationTags";
  public static final String CREATED_BY = "createdBy";
  public static final String DATA_SOURCE_TAGS = "dataSourceTags";
  public static final String DISPLAY_NAME = "displayName";
  public static final String DISPLAY_NAME_SEARCH = "displayNameSearch";
  public static final String DOMAIN_IDS = "domainIds";
  public static final String ENTITY_STATUS = "entityStatus";
  public static final String GLOSSARY_ID = "glossaryId";
  public static final String NAME = "name";
  public static final String NAME_SEARCH = "nameSearch";
  public static final String OWNER_IDS = "ownerIds";
  public static final String PARENT_BUSINESS_VERSION = "parentBusinessVersion";
  public static final String RECORD_TYPE = "recordType";
  public static final String REVISION_MARKER = "revisionMarker";
  public static final String TERM_ID = "termId";

  private GovernedGlossaryIndexFields() {}
}
