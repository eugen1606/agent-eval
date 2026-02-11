import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Run } from '../database/entities';

interface RunStats {
  total: number;
  evaluated: number;
  correct: number;
  partial: number;
  incorrect: number;
  errors: number;
  accuracy: number | null;
}

interface PerfStats {
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

interface DashboardRow {
  runId: string;
  date: string;
  accuracy: number | null;
  correct: number;
  partial: number;
  incorrect: number;
  errors: number;
  total: number;
  avgLatencyMs: number | null;
}

@Injectable()
export class ReportService {
  private escapeCsvField(value: string): string {
    if (
      value.includes(',') ||
      value.includes('"') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private csvRow(fields: string[]): string {
    return fields.map((f) => this.escapeCsvField(f)).join(',');
  }

  generateRunCsv(run: Run, stats: RunStats, perfStats: PerfStats): string {
    const lines: string[] = [];

    // Evaluation Summary
    lines.push('Evaluation Summary');
    lines.push(this.csvRow(['Total', 'Correct', 'Partial', 'Incorrect', 'Errors', 'Accuracy (%)']));
    lines.push(this.csvRow([
      String(stats.total),
      String(stats.correct),
      String(stats.partial),
      String(stats.incorrect),
      String(stats.errors),
      stats.accuracy != null ? String(stats.accuracy) : 'N/A',
    ]));
    lines.push('');

    // Performance Statistics
    if (perfStats.count > 0) {
      lines.push('Performance Statistics');
      lines.push(this.csvRow(['Count', 'Min (ms)', 'Max (ms)', 'Avg (ms)', 'P50 (ms)', 'P95 (ms)', 'P99 (ms)']));
      lines.push(this.csvRow([
        String(perfStats.count),
        perfStats.min != null ? String(perfStats.min) : 'N/A',
        perfStats.max != null ? String(perfStats.max) : 'N/A',
        perfStats.avg != null ? String(perfStats.avg) : 'N/A',
        perfStats.p50 != null ? String(perfStats.p50) : 'N/A',
        perfStats.p95 != null ? String(perfStats.p95) : 'N/A',
        perfStats.p99 != null ? String(perfStats.p99) : 'N/A',
      ]));
      lines.push('');
    }

    // Results
    lines.push('Results');
    lines.push(this.csvRow([
      'Question',
      'Answer',
      'Expected Answer',
      'Evaluation',
      'Severity',
      'Latency (ms)',
      'Error',
    ]));

    for (const r of run.results) {
      lines.push(this.csvRow([
        r.question || '',
        r.answer || '',
        r.expectedAnswer || '',
        r.humanEvaluation || '',
        r.severity || '',
        r.executionTimeMs != null ? String(r.executionTimeMs) : '',
        r.isError ? r.errorMessage || 'Error' : '',
      ]));
    }

    return lines.join('\n');
  }

  generateDashboardCsv(testName: string, rows: DashboardRow[]): string {
    const header = this.csvRow([
      'Run ID',
      'Date',
      'Accuracy (%)',
      'Correct',
      'Partial',
      'Incorrect',
      'Errors',
      'Total',
      'Avg Latency (ms)',
    ]);

    const dataRows = rows.map((r) =>
      this.csvRow([
        r.runId,
        r.date,
        r.accuracy != null ? String(r.accuracy) : '',
        String(r.correct),
        String(r.partial),
        String(r.incorrect),
        String(r.errors),
        String(r.total),
        r.avgLatencyMs != null ? String(r.avgLatencyMs) : '',
      ]),
    );

    return [header, ...dataRows].join('\n');
  }

  async generateRunPdf(
    run: Run,
    stats: RunStats,
    perfStats: PerfStats,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const testName = run.test?.name || 'Unknown Test';
      const shortId = run.id.slice(0, 8);

      // Title — test name only
      doc.fontSize(18).text(testName, { align: 'center' });
      doc.moveDown(0.5);

      // Metadata — includes run ID
      doc.fontSize(10).fillColor('#666666');
      const metaParts = [
        `Run: ${shortId}`,
        `Status: ${run.status}`,
        `Created: ${run.createdAt ? new Date(run.createdAt).toLocaleString() : 'N/A'}`,
      ];
      if (run.completedAt) {
        metaParts.push(`Completed: ${new Date(run.completedAt).toLocaleString()}`);
      }
      doc.text(metaParts.join('  |  '), { align: 'center' });
      doc.moveDown(1);
      doc.fillColor('#000000');

      // Evaluation summary table
      doc.fontSize(13).text('Evaluation Summary');
      doc.moveDown(0.3);
      this.drawTable(doc, {
        headers: ['Total', 'Correct', 'Partial', 'Incorrect', 'Errors', 'Accuracy'],
        rows: [[
          String(stats.total),
          String(stats.correct),
          String(stats.partial),
          String(stats.incorrect),
          String(stats.errors),
          stats.accuracy != null ? `${stats.accuracy}%` : 'N/A',
        ]],
      });
      doc.moveDown(1);

      // Performance stats table
      if (perfStats.count > 0) {
        doc.fontSize(13).text('Performance Statistics');
        doc.moveDown(0.3);
        this.drawTable(doc, {
          headers: ['Count', 'Min (ms)', 'Max (ms)', 'Avg (ms)', 'P50 (ms)', 'P95 (ms)', 'P99 (ms)'],
          rows: [[
            String(perfStats.count),
            perfStats.min != null ? String(perfStats.min) : 'N/A',
            perfStats.max != null ? String(perfStats.max) : 'N/A',
            perfStats.avg != null ? String(perfStats.avg) : 'N/A',
            perfStats.p50 != null ? String(perfStats.p50) : 'N/A',
            perfStats.p95 != null ? String(perfStats.p95) : 'N/A',
            perfStats.p99 != null ? String(perfStats.p99) : 'N/A',
          ]],
        });
        doc.moveDown(1);
      }

      // Results table
      if (run.results.length > 0) {
        doc.addPage();
        doc.fontSize(13).text('Results');
        doc.moveDown(0.3);

        this.drawTable(doc, {
          headers: ['#', 'Question', 'Answer', 'Evaluation', 'Latency', 'Error'],
          colWidths: [25, 155, 155, 65, 50, 45],
          rows: run.results.map((r, i) => [
            String(i + 1),
            r.question || '',
            r.answer || '',
            r.humanEvaluation || '',
            r.executionTimeMs != null ? `${r.executionTimeMs}ms` : '',
            r.isError ? 'Yes' : '',
          ]),
          fontSize: 7,
          wrapText: true,
        });
      }

      doc.end();
    });
  }

  private drawTable(
    doc: PDFKit.PDFDocument,
    options: {
      headers: string[];
      rows: string[][];
      colWidths?: number[];
      fontSize?: number;
      wrapText?: boolean;
    },
  ) {
    const { headers, rows, fontSize = 9, wrapText = false } = options;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidths =
      options.colWidths || headers.map(() => tableWidth / headers.length);
    const startX = doc.page.margins.left;
    const fixedRowHeight = fontSize + 8;
    const cellPadding = 3;
    let y = doc.y;

    // Header
    doc.fontSize(fontSize).font('Helvetica-Bold');
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x + 2, y + cellPadding, {
        width: colWidths[i] - 4,
        height: fixedRowHeight,
        lineBreak: false,
      });
      x += colWidths[i];
    }
    y += fixedRowHeight;

    // Draw header line
    doc
      .moveTo(startX, y)
      .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y)
      .stroke();
    y += 2;

    // Data rows
    doc.font('Helvetica');
    for (const row of rows) {
      // Calculate row height
      let rowHeight = fixedRowHeight;
      if (wrapText) {
        for (let i = 0; i < row.length; i++) {
          const cellWidth = colWidths[i] - 4;
          const textHeight = doc.heightOfString(row[i], { width: cellWidth });
          rowHeight = Math.max(rowHeight, textHeight + cellPadding * 2);
        }
      }

      // Check if we need a new page
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      x = startX;
      for (let i = 0; i < row.length; i++) {
        if (wrapText) {
          doc.text(row[i], x + 2, y + cellPadding, {
            width: colWidths[i] - 4,
            lineBreak: true,
          });
        } else {
          doc.text(row[i], x + 2, y + cellPadding, {
            width: colWidths[i] - 4,
            height: fixedRowHeight,
            lineBreak: false,
          });
        }
        x += colWidths[i];
      }
      y += rowHeight;

      // Draw row separator for wrapped rows
      if (wrapText) {
        doc
          .strokeColor('#eeeeee')
          .moveTo(startX, y)
          .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y)
          .stroke()
          .strokeColor('#000000');
        y += 1;
      }
    }

    doc.x = doc.page.margins.left;
    doc.y = y + 2;
  }
}
