/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static com.cronutils.model.CronType.UNIX;

import com.cronutils.model.Cron;
import com.cronutils.model.definition.CronDefinitionBuilder;
import com.cronutils.model.time.ExecutionTime;
import com.cronutils.parser.CronParser;
import java.time.Duration;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** The cron schedule a user sets on a Rule: validation and the run times it produces. */
public final class DqSchedule {
  public static final String DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";
  public static final int PREVIEW_RUNS = 5;
  private static final int MAX_CRON_LENGTH = 128;
  private static final CronParser PARSER =
      new CronParser(CronDefinitionBuilder.instanceDefinitionFor(UNIX));

  private DqSchedule() {}

  /** Throws {@code DQ_SCHEDULE_INVALID} for an unparsable cron or unknown time zone. */
  public static void validate(String cron, String timezone) {
    if (cron != null) {
      if (cron.isBlank() || cron.length() > MAX_CRON_LENGTH) {
        throw invalid("Cron expression must have 1 to 128 characters");
      }
      parse(cron);
    }
    zone(timezone);
  }

  public static List<ZonedDateTime> nextRuns(String cron, String timezone, int count) {
    final List<ZonedDateTime> runs = new ArrayList<>();
    if (cron != null && !cron.isBlank()) {
      final ExecutionTime time = ExecutionTime.forCron(parse(cron));
      Optional<ZonedDateTime> next = time.nextExecution(ZonedDateTime.now(zone(timezone)));
      while (next.isPresent() && runs.size() < count) {
        runs.add(next.get());
        next = time.nextExecution(next.get());
      }
    }
    return runs;
  }

  /** Gap between two consecutive runs, or empty when there is no schedule. */
  public static Optional<Duration> interval(String cron, String timezone) {
    final List<ZonedDateTime> runs = nextRuns(cron, timezone, 2);
    return runs.size() < 2
        ? Optional.empty()
        : Optional.of(Duration.between(runs.get(0), runs.get(1)));
  }

  private static Cron parse(String cron) {
    try {
      return PARSER.parse(cron.trim());
    } catch (IllegalArgumentException exception) {
      throw invalid("Cron expression '" + cron + "' is not valid");
    }
  }

  private static ZoneId zone(String timezone) {
    try {
      return ZoneId.of(timezone == null || timezone.isBlank() ? DEFAULT_TIMEZONE : timezone);
    } catch (java.time.DateTimeException exception) {
      throw invalid("Time zone '" + timezone + "' is not valid");
    }
  }

  private static jakarta.ws.rs.WebApplicationException invalid(String message) {
    return DqTestErrors.badRequest(DqTestErrors.SCHEDULE_INVALID, message, null);
  }
}
