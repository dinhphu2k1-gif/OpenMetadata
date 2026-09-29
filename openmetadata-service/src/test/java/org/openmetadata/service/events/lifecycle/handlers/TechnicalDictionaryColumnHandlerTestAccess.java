/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.events.lifecycle.handlers;

import java.util.List;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;

/** Exposes package-private parsing of the handler to tests in other packages. */
public final class TechnicalDictionaryColumnHandlerTestAccess {
  private TechnicalDictionaryColumnHandlerTestAccess() {}

  public static List<Column> deletedColumns(ChangeDescription changeDescription) {
    return TechnicalDictionaryColumnHandler.deletedColumns(changeDescription);
  }
}
