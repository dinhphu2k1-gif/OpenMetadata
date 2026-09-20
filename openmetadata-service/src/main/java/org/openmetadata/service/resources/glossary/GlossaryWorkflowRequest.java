/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.resources.glossary;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GlossaryWorkflowRequest {
  private Double expectedNativeVersion;
  private String businessVersion;
}
