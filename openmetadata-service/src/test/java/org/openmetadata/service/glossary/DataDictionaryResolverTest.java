/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
package org.openmetadata.service.glossary;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.type.ProviderType;

class DataDictionaryResolverTest {
  private static CreateGlossaryTerm validCreate() {
    return new CreateGlossaryTerm()
        .withGlossary(DataDictionaryResolver.DATA_DICTIONARY_NAME)
        .withName("CDE_001")
        .withDescription("Customer identifier");
  }

  @Test
  void acceptsOnlyTheDirectCdeCreateContract() {
    assertDoesNotThrow(() -> DataDictionaryResolver.requireDirectCdeCreate(validCreate()));
  }

  @Test
  void acceptsNeutralDefaultsAddedByGeneratedClients() {
    CreateGlossaryTerm create =
        validCreate()
            .withSynonyms(List.of())
            .withRelatedTerms(List.of())
            .withReferences(List.of())
            .withConceptMappings(List.of())
            .withMutuallyExclusive(false);

    assertDoesNotThrow(() -> DataDictionaryResolver.requireDirectCdeCreate(create));
  }

  @Test
  void rejectsAnotherGlossaryAndSubTerms() {
    assertThrows(
        BadRequestException.class,
        () ->
            DataDictionaryResolver.requireDirectCdeCreate(
                validCreate().withGlossary("Another Glossary")));
    assertThrows(
        BadRequestException.class,
        () ->
            DataDictionaryResolver.requireDirectCdeCreate(
                validCreate().withParent("Data Dictionary.Parent")));
  }

  @Test
  void rejectsNativeAndServerControlledCreateOptions() {
    assertThrows(
        BadRequestException.class,
        () ->
            DataDictionaryResolver.requireDirectCdeCreate(
                validCreate().withProvider(ProviderType.USER)));
    assertThrows(
        BadRequestException.class,
        () ->
            DataDictionaryResolver.requireDirectCdeCreate(
                validCreate().withMutuallyExclusive(true)));
    assertThrows(
        BadRequestException.class,
        () ->
            DataDictionaryResolver.requireDirectCdeCreate(
                validCreate().withSynonyms(List.of("unsupported"))));
  }
}
