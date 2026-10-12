/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.notification;

/**
 * What happened to a review queue: a request was submitted, or one was decided (approved,
 * rejected or withdrawn). Signals of one batch merge into one, a submission taking precedence.
 */
record ReviewSignal(boolean submitted, String actor) {
  static ReviewSignal submittedBy(String actor) {
    return new ReviewSignal(true, actor);
  }

  static ReviewSignal decidedBy(String actor) {
    return new ReviewSignal(false, actor);
  }

  ReviewSignal merge(ReviewSignal later) {
    return submitted && !later.submitted ? this : later;
  }
}
