/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.WebApplicationException;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TechnicalRecordValidatorTest {
  private static final UUID TEAM_ID = UUID.randomUUID();
  private static final UUID CDE_ID = UUID.randomUUID();

  private final TechnicalRecordValidator validator =
      new TechnicalRecordValidator(
          new TechnicalRecordValidator.ReferenceLookup() {
            @Override
            public boolean tagExists(String tagFqn) {
              return !tagFqn.endsWith("Missing");
            }

            @Override
            public boolean teamExists(UUID teamId) {
              return TEAM_ID.equals(teamId);
            }
          });

  private static TechnicalRecordValues values(UUID cde, Integer rank, String timeliness) {
    return new TechnicalRecordValues(
        cde, rank, "DataElementType.AtomicDataElement", null, null, timeliness, TEAM_ID);
  }

  private static String code(WebApplicationException exception) {
    return TechnicalDictionaryErrors.codeOf(exception);
  }

  @Test
  void acceptsCompleteValuesAndReturnsThemNormalized() {
    TechnicalRecordValues validated = validator.validate(values(CDE_ID, 3, " DataTimeliness.T1 "));

    assertEquals(CDE_ID, validated.cde());
    assertEquals(3, validated.rank());
    assertEquals("DataTimeliness.T1", validated.timeliness());
    assertEquals(TEAM_ID, validated.systemOwnerId());
  }

  @Test
  void blankTagsAreClearedAndAnEmptyRecordIsValid() {
    TechnicalRecordValues validated =
        validator.validate(new TechnicalRecordValues(null, null, "", null, "  ", null, null));

    assertNull(validated.elementType());
    assertNull(validated.creationMethod());
    assertEquals(TechnicalRecordValues.EMPTY, validated);
  }

  @Test
  void ranksMustBeInRangeAndMatchTheCde() {
    WebApplicationException tooHigh =
        assertThrows(
            WebApplicationException.class, () -> validator.validate(values(CDE_ID, 1000, null)));
    WebApplicationException missing =
        assertThrows(
            WebApplicationException.class, () -> validator.validate(values(CDE_ID, null, null)));
    WebApplicationException orphan =
        assertThrows(
            WebApplicationException.class, () -> validator.validate(values(null, 1, null)));

    assertEquals(TechnicalDictionaryErrors.INVALID_FIELD, code(tooHigh));
    assertEquals(TechnicalDictionaryErrors.RANK_REQUIRED, code(missing));
    assertEquals(TechnicalDictionaryErrors.INVALID_FIELD, code(orphan));
  }

  @Test
  void tagsMustBelongToTheirClassificationAndExist() {
    WebApplicationException wrongClassification =
        assertThrows(
            WebApplicationException.class,
            () -> validator.validate(values(null, null, "DataElementType.AtomicDataElement")));
    WebApplicationException unknown =
        assertThrows(
            WebApplicationException.class,
            () -> validator.validate(values(null, null, "DataTimeliness.Missing")));

    assertEquals(TechnicalDictionaryErrors.INVALID_FIELD, code(wrongClassification));
    assertEquals(TechnicalDictionaryErrors.INVALID_FIELD, code(unknown));
  }

  @Test
  void theSystemOwnerMustBeAnExistingTeam() {
    TechnicalRecordValues values =
        new TechnicalRecordValues(null, null, null, null, null, null, UUID.randomUUID());

    assertEquals(
        TechnicalDictionaryErrors.INVALID_FIELD,
        code(assertThrows(WebApplicationException.class, () -> validator.validate(values))));
  }
}
