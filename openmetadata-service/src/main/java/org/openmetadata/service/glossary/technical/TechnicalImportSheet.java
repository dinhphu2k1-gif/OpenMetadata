/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;
import javax.xml.parsers.ParserConfigurationException;
import org.apache.poi.ooxml.POIXMLException;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.openxml4j.exceptions.OpenXML4JException;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.openxml4j.opc.PackagePart;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.util.XMLHelper;
import org.apache.poi.xssf.eventusermodel.ReadOnlySharedStringsTable;
import org.apache.poi.xssf.eventusermodel.XSSFReader;
import org.apache.poi.xssf.eventusermodel.XSSFSheetXMLHandler;
import org.apache.poi.xssf.eventusermodel.XSSFSheetXMLHandler.SheetContentsHandler;
import org.apache.poi.xssf.model.StylesTable;
import org.apache.poi.xssf.usermodel.XSSFComment;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.XMLReader;

/**
 * Bounded, streaming reader of the first worksheet of an import workbook. Rows are exposed by
 * header name so the column order of the file does not matter.
 */
public final class TechnicalImportSheet {
  public static final long MAX_FILE_BYTES = 20L * 1024 * 1024;
  public static final int MAX_ROWS = 70_000;
  public static final int MAX_CELL_LENGTH = 32_000;
  private static final Pattern FORMULA_PREFIX = Pattern.compile("^[=+@].*|^-.*");
  private static final double MIN_INFLATE_RATIO = 0.01d;

  private final List<String> headers;
  private final List<Row> rows;

  private TechnicalImportSheet(List<String> headers, List<Row> rows) {
    this.headers = List.copyOf(headers);
    this.rows = List.copyOf(rows);
  }

  public List<String> headers() {
    return headers;
  }

  public List<Row> rows() {
    return rows;
  }

  /** One data row: a 1-based spreadsheet row number and its non-blank-trimmed cells by header. */
  public record Row(int rowNumber, Map<String, String> values) {
    public boolean has(String header) {
      return values.containsKey(header);
    }

    public String value(String header) {
      return values.getOrDefault(header, "");
    }
  }

  public static TechnicalImportSheet parse(byte[] bytes) {
    final double previousRatio = ZipSecureFile.getMinInflateRatio();
    ZipSecureFile.setMinInflateRatio(MIN_INFLATE_RATIO);
    try (OPCPackage pkg = OPCPackage.open(new ByteArrayInputStream(bytes))) {
      rejectUnsafeParts(pkg);
      final Collector collector = new Collector();
      readFirstSheet(pkg, collector);
      return collector.toSheet();
    } catch (ClientErrorException exception) {
      throw exception;
    } catch (IOException
        | SAXException
        | OpenXML4JException
        | ParserConfigurationException
        | IllegalArgumentException
        | POIXMLException exception) {
      throw new BadRequestException("Malformed or unsafe XLSX workbook", exception);
    } finally {
      ZipSecureFile.setMinInflateRatio(previousRatio);
    }
  }

  private static void readFirstSheet(OPCPackage pkg, Collector collector)
      throws IOException, SAXException, OpenXML4JException, ParserConfigurationException {
    final XSSFReader reader = new XSSFReader(pkg);
    final ReadOnlySharedStringsTable strings = new ReadOnlySharedStringsTable(pkg);
    final StylesTable styles = reader.getStylesTable();
    final XSSFReader.SheetIterator sheets = (XSSFReader.SheetIterator) reader.getSheetsData();
    if (!sheets.hasNext()) {
      throw new BadRequestException("Workbook does not contain a worksheet");
    }
    try (InputStream sheet = sheets.next()) {
      final XSSFSheetXMLHandler handler =
          new XSSFSheetXMLHandler(styles, null, strings, collector, new DataFormatter(), false);
      final XMLReader parser = XMLHelper.newXMLReader();
      parser.setContentHandler(handler);
      parser.parse(new InputSource(sheet));
    }
  }

  private static void rejectUnsafeParts(OPCPackage pkg) throws InvalidFormatException {
    for (PackagePart part : pkg.getParts()) {
      final String name = part.getPartName().getName().toLowerCase(Locale.ROOT);
      if (name.contains("vbaproject")
          || name.contains("/embeddings/")
          || name.contains("externallink")) {
        throw new BadRequestException(
            "Macros, external links and embedded objects are not allowed");
      }
    }
  }

  /** Reads an upload fully, refusing anything above {@link #MAX_FILE_BYTES}. */
  public static byte[] readBytes(InputStream input, long contentLength) {
    if (input == null) {
      throw new BadRequestException("file is required");
    }
    if (contentLength > MAX_FILE_BYTES) {
      throw tooLarge();
    }
    final ByteArrayOutputStream output = new ByteArrayOutputStream();
    try {
      input.transferTo(new LimitedOutputStream(output));
    } catch (FileTooLargeException exception) {
      throw tooLarge();
    } catch (IOException exception) {
      throw new BadRequestException("Unable to read XLSX file", exception);
    }
    return output.toByteArray();
  }

  private static ClientErrorException tooLarge() {
    return new ClientErrorException(
        "XLSX exceeds the import limit", Response.Status.REQUEST_ENTITY_TOO_LARGE);
  }

  private static final class FileTooLargeException extends IOException {}

  private static final class LimitedOutputStream extends OutputStream {
    private final OutputStream target;
    private long count;

    private LimitedOutputStream(OutputStream target) {
      this.target = target;
    }

    @Override
    public void write(int value) throws IOException {
      write(new byte[] {(byte) value}, 0, 1);
    }

    @Override
    public void write(byte[] value, int offset, int length) throws IOException {
      count += length;
      if (count > MAX_FILE_BYTES) {
        throw new FileTooLargeException();
      }
      target.write(value, offset, length);
    }
  }

  private static final class Collector implements SheetContentsHandler {
    private final List<String> headers = new ArrayList<>();
    private final List<Row> rows = new ArrayList<>();
    private final Map<Integer, String> current = new TreeMap<>();
    private int currentRow;

    @Override
    public void startRow(int rowNum) {
      currentRow = rowNum + 1;
      current.clear();
    }

    @Override
    public void cell(String cellReference, String formattedValue, XSSFComment comment) {
      final String value = formattedValue == null ? "" : formattedValue.trim();
      if (value.length() > MAX_CELL_LENGTH
          || (currentRow > 1 && FORMULA_PREFIX.matcher(value).matches())) {
        throw new BadRequestException("Unsafe or oversized value at row " + currentRow);
      }
      current.put((int) new CellReference(cellReference).getCol(), value);
    }

    @Override
    public void endRow(int rowNum) {
      if (headers.isEmpty()) {
        current.values().forEach(headers::add);
      } else if (current.values().stream().anyMatch(value -> !value.isBlank())) {
        addDataRow();
      }
    }

    private void addDataRow() {
      if (rows.size() >= MAX_ROWS) {
        throw tooLarge();
      }
      final Map<String, String> values = new LinkedHashMap<>();
      for (Map.Entry<Integer, String> entry : current.entrySet()) {
        if (entry.getKey() < headers.size() && !headers.get(entry.getKey()).isBlank()) {
          values.put(headers.get(entry.getKey()), entry.getValue());
        }
      }
      rows.add(new Row(currentRow, values));
    }

    private TechnicalImportSheet toSheet() {
      if (headers.isEmpty()) {
        throw new BadRequestException("The first row must contain the column headers");
      }
      return new TechnicalImportSheet(headers, rows);
    }
  }
}
