/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary;

import jakarta.ws.rs.BadRequestException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import org.openmetadata.schema.entity.data.Glossary;

/** Central allowlist for glossaries that use the governed business-version workflow. */
public final class GovernedGlossaryProfileRegistry {
  public static final int SCHEMA_VERSION = 1;

  public enum Profile {
    DATA_DICTIONARY("Data Dictionary"),
    DATA_QUALITY("Data Quality");

    private final String glossaryName;

    Profile(String glossaryName) {
      this.glossaryName = glossaryName;
    }

    public String glossaryName() {
      return glossaryName;
    }

    public String profileKey() {
      return name();
    }
  }

  private GovernedGlossaryProfileRegistry() {}

  public static Optional<Profile> findByName(String glossaryName) {
    if (glossaryName == null) {
      return Optional.empty();
    }
    String normalized = glossaryName.trim().toLowerCase(Locale.ROOT);
    return Arrays.stream(Profile.values())
        .filter(profile -> profile.glossaryName.toLowerCase(Locale.ROOT).equals(normalized))
        .findFirst();
  }

  public static Optional<Profile> find(Glossary glossary) {
    return glossary == null ? Optional.empty() : findByName(glossary.getName());
  }

  public static Profile require(Glossary glossary) {
    return find(glossary)
        .orElseThrow(
            () -> new BadRequestException("Glossary does not have a governed glossary profile"));
  }

  public static Profile requireName(String glossaryName) {
    return findByName(glossaryName)
        .orElseThrow(
            () -> new BadRequestException("Glossary does not have a governed glossary profile"));
  }

  public static Profile requireFqn(String fullyQualifiedName) {
    if (fullyQualifiedName != null) {
      for (Profile profile : Profile.values()) {
        if (profile.glossaryName.equals(fullyQualifiedName)
            || fullyQualifiedName.startsWith(profile.glossaryName + ".")) {
          return profile;
        }
      }
    }
    throw new BadRequestException("Glossary does not have a governed glossary profile");
  }

  public static boolean isGoverned(Glossary glossary) {
    return find(glossary).isPresent();
  }
}
