/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Idempotently registers GlossaryTerm custom properties used by governed glossary profiles.
 * Existing definitions are validated instead of silently rewritten, so schema drift fails fast.
 */
public final class GovernedCustomPropertyBootstrap {

  private GovernedCustomPropertyBootstrap() {}

  public static void ensure(PropertyDefinition definition) {
    final String registeredType = registeredType(definition.name());
    if (registeredType == null) {
      create(definition);
    } else {
      requireCompatible(definition, registeredType);
    }
  }

  private static String registeredType(String propertyName) {
    String result = null;
    try {
      result = TypeRegistry.getCustomPropertyType(Entity.GLOSSARY_TERM, propertyName);
    } catch (EntityNotFoundException ignored) {
      // Not registered yet; the caller creates it.
    }
    return result;
  }

  private static void requireCompatible(PropertyDefinition definition, String registeredType) {
    final String registeredConfig =
        TypeRegistry.getCustomPropertyConfig(Entity.GLOSSARY_TERM, definition.name());
    if (!definition.propertyType().equals(registeredType)
        || !hasSameConfig(definition.config(), registeredConfig)) {
      throw new IllegalStateException(
          String.format(
              "Custom property '%s' on '%s' has schema drift: expected type '%s'",
              definition.name(), Entity.GLOSSARY_TERM, definition.propertyType()));
    }
  }

  private static boolean hasSameConfig(Object expected, String registeredConfig) {
    return expected == null
        || (registeredConfig != null
            && JsonUtils.valueToTree(expected).equals(JsonUtils.readTree(registeredConfig)));
  }

  private static void create(PropertyDefinition definition) {
    final Type glossaryTermType =
        Entity.getTypeRepository().findByName(Entity.GLOSSARY_TERM, Include.NON_DELETED);
    final CustomProperty property =
        new CustomProperty()
            .withName(definition.name())
            .withDisplayName(definition.displayName())
            .withDescription(definition.description())
            .withPropertyType(
                Entity.getEntityReferenceByName(
                    Entity.TYPE, definition.propertyType(), Include.NON_DELETED));
    if (definition.config() != null) {
      property.withCustomPropertyConfig(new CustomPropertyConfig().withConfig(definition.config()));
    }
    Entity.getTypeRepository()
        .addCustomProperty(null, ADMIN_USER_NAME, glossaryTermType.getId(), property);
  }

  /** Declarative definition of one GlossaryTerm custom property. */
  public record PropertyDefinition(
      String name, String displayName, String description, String propertyType, Object config) {}
}
