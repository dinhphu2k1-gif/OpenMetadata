/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary;

import jakarta.ws.rs.BadRequestException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Resolves the single glossary that is exposed as the product Data Dictionary. */
public final class DataDictionaryResolver {
  public static final String DATA_DICTIONARY_NAME = "Data Dictionary";

  private DataDictionaryResolver() {}

  public static boolean isDataDictionary(Glossary glossary) {
    return glossary != null && DATA_DICTIONARY_NAME.equals(glossary.getName());
  }

  public static Glossary requireDataDictionary(Glossary glossary) {
    if (!isDataDictionary(glossary)) {
      throw unsupportedGlossary();
    }
    return glossary;
  }

  public static void requireDataDictionaryName(String name) {
    if (!DATA_DICTIONARY_NAME.equals(name)) {
      throw unsupportedGlossary();
    }
  }

  public static void requireDataDictionaryFqn(String fullyQualifiedName) {
    if (fullyQualifiedName == null
        || !(DATA_DICTIONARY_NAME.equals(fullyQualifiedName)
            || fullyQualifiedName.startsWith(DATA_DICTIONARY_NAME + "."))) {
      throw unsupportedGlossary();
    }
  }

  /** Resolve by entity identity, never by a mutable display name. */
  public static Glossary resolveDataDictionary(EntityReference glossaryReference) {
    if (glossaryReference == null || glossaryReference.getId() == null) {
      throw new BadRequestException("A CDE must reference the Data Dictionary glossary");
    }
    EntityReference reference =
        new EntityReference().withId(glossaryReference.getId()).withType(Entity.GLOSSARY);
    Glossary glossary = Entity.getEntity(reference, "id,name", Include.NON_DELETED);
    return requireDataDictionary(glossary);
  }

  public static GlossaryTerm requireCde(GlossaryTerm term) {
    Objects.requireNonNull(term, "Glossary term is required");
    resolveDataDictionary(term.getGlossary());
    return term;
  }

  public static void requireDataDictionaryPayload(Object payload) {
    Map<String, Object> values = payloadValues(payload);
    requireDataDictionaryName(String.valueOf(values.get("name")));
    Object versioningMode = values.get("versioningMode");
    if (versioningMode != null && !"BusinessWorkflow".equals(String.valueOf(versioningMode))) {
      throw new BadRequestException("Data Dictionary must use BusinessWorkflow");
    }
  }

  public static void requireCdePayload(Object payload, UUID expectedGlossaryId) {
    Map<String, Object> values = payloadValues(payload);
    if (values.containsKey("workflow")
        || values.containsKey("workflowConfig")
        || values.containsKey("versioningMode")) {
      throw new BadRequestException(
          "A CDE inherits the Data Dictionary workflow and cannot configure its own workflow");
    }
    Object glossaryValue = values.get("glossary");
    if (glossaryValue == null) {
      throw new BadRequestException("A CDE payload must reference the Data Dictionary glossary");
    }
    EntityReference glossaryReference =
        JsonUtils.readValue(JsonUtils.pojoToJson(glossaryValue), EntityReference.class);
    if (!expectedGlossaryId.equals(glossaryReference.getId())) {
      throw new BadRequestException("A CDE cannot be moved outside the Data Dictionary");
    }
    resolveDataDictionary(glossaryReference);
  }

  public static void requireDirectCdeCreate(
      org.openmetadata.schema.api.data.CreateGlossaryTerm create) {
    requireDataDictionaryName(create.getGlossary());
    if (create.getParent() != null) {
      throw new BadRequestException("A CDE must be a direct child of the Data Dictionary");
    }
    rejectUnsupportedCreateField("provider", create.getProvider() != null);
    rejectUnsupportedCreateField("style", create.getStyle() != null);
    rejectUnsupportedCreateField(
        "synonyms", create.getSynonyms() != null && !create.getSynonyms().isEmpty());
    rejectUnsupportedCreateField(
        "relatedTerms", create.getRelatedTerms() != null && !create.getRelatedTerms().isEmpty());
    rejectUnsupportedCreateField(
        "references", create.getReferences() != null && !create.getReferences().isEmpty());
    rejectUnsupportedCreateField(
        "conceptMappings",
        create.getConceptMappings() != null && !create.getConceptMappings().isEmpty());
    rejectUnsupportedCreateField(
        "mutuallyExclusive", Boolean.TRUE.equals(create.getMutuallyExclusive()));
  }

  private static void rejectUnsupportedCreateField(String field, boolean present) {
    if (present) {
      throw new BadRequestException(
          "Create CDE contains field outside the F03 allowlist: " + field);
    }
  }

  private static Map<String, Object> payloadValues(Object payload) {
    Object parsed =
        payload instanceof String
            ? JsonUtils.readValue((String) payload, Object.class)
            : JsonUtils.readValue(JsonUtils.pojoToJson(payload), Object.class);
    if (!(parsed instanceof Map<?, ?> raw)) {
      throw new BadRequestException("Working payload must be a JSON object");
    }
    Map<String, Object> values = new LinkedHashMap<>();
    raw.forEach((key, value) -> values.put(String.valueOf(key), value));
    return values;
  }

  private static BadRequestException unsupportedGlossary() {
    return new BadRequestException("Only the '" + DATA_DICTIONARY_NAME + "' glossary is supported");
  }
}
