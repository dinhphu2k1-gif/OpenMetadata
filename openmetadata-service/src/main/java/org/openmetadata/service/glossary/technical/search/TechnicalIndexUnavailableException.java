/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

/** The search engine rejected or could not serve a Technical Dictionary index operation. */
public class TechnicalIndexUnavailableException extends RuntimeException {
  public TechnicalIndexUnavailableException(String message) {
    super(message);
  }

  public TechnicalIndexUnavailableException(String message, Throwable cause) {
    super(message, cause);
  }
}
