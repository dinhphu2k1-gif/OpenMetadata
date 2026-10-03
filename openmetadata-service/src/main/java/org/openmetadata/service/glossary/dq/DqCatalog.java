/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry;

/** Resolves the Data Quality glossary and checks that a term is one of its Rules. */
public final class DqCatalog {
  private DqCatalog() {}

  public static Glossary requireGlossary() {
    return Entity.getEntityByName(
        Entity.GLOSSARY,
        GovernedGlossaryProfileRegistry.Profile.DATA_QUALITY.glossaryName(),
        "",
        Include.NON_DELETED);
  }

  /** The Rule identity, or a 404 when the id is not a term of the Data Quality glossary. */
  public static GlossaryTerm requireRule(UUID ruleId) {
    final GlossaryTerm term =
        Entity.getEntity(Entity.GLOSSARY_TERM, ruleId, "glossary", Include.NON_DELETED);
    final boolean isRule =
        term.getGlossary() != null
            && GovernedGlossaryProfileRegistry.Profile.DATA_QUALITY
                .glossaryName()
                .equals(term.getGlossary().getName());
    if (!isRule) {
      throw DqTestErrors.notFound(DqTestErrors.NOT_A_RULE, "The term is not a Data Quality Rule");
    }
    return term;
  }
}
