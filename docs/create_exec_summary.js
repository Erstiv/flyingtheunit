const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const ACCENT = "1A3C6E";
const LIGHT_BG = "EDF2F7";

function makeCell(text, width, opts = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(new TextRun({ text, bold: opts.bold || false, size: opts.size || 20, font: "Arial", color: opts.color || "333333" }));
  } else {
    runs.push(text);
  }
  return new TableCell({
    borders: opts.noBorders ? noBorders : borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({ alignment: opts.align || AlignmentType.LEFT, children: runs })],
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
          children: [
            new TextRun({ text: "THE UNIT", bold: true, size: 18, font: "Arial", color: ACCENT }),
            new TextRun({ text: "    CONFIDENTIAL \u2014 EXECUTIVE SUMMARY", size: 16, font: "Arial", color: "999999" }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "flyingunit.com  |  Page ", size: 16, color: "999999", font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999", font: "Arial" }),
          ]
        })]
      })
    },
    children: [
      // Title
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "THE UNIT", bold: true, size: 48, font: "Arial", color: ACCENT })]
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [new TextRun({ text: "AI-Powered Meme Intelligence & Automated Response Platform", size: 24, font: "Arial", color: "666666" })]
      }),

      // What It Is
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("What It Is")] }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "The Unit is an AI-powered social intelligence platform that monitors conversations across social media, identifies memes about a client\u2019s brand or property, and ", size: 21, font: "Arial" }),
        new TextRun({ text: "automatically generates response memes using actual footage from the client\u2019s own content library", bold: true, size: 21, font: "Arial" }),
        new TextRun({ text: ". It combines social listening, sentiment analysis, perceptual hash fingerprinting, Gemini Vision AI, and generative compositing into a single automated pipeline.", size: 21, font: "Arial" })]
      }),

      // Key Differentiators
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Key Differentiators")] }),
      ...[
        "Only platform that generates memes FROM the client\u2019s own IP and footage \u2014 not stock templates",
        "Scene-matching AI finds the perfect emotional moment from indexed video content (42+ metadata fields per scene)",
        "Character system allows multiple brand personas with distinct voices and posting strategies",
        "Real-time monitoring across YouTube, Reddit, Imgur, Hacker News \u2014 expanding to X, TikTok, Instagram",
        "Fully automated pipeline: detect \u2192 identify \u2192 match \u2192 generate \u2192 queue \u2192 post",
      ].map(t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 20, font: "Arial" })] })),

      // Target Market
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Target Market")] }),
      new Paragraph({ spacing: { after: 200 }, children: [
        new TextRun({ text: "Streaming studios (Angel Studios, Lionsgate, A24), entertainment properties with passionate fanbases, gaming companies, consumer brands, and advocacy organizations.", size: 20, font: "Arial" })
      ]}),

      // Pricing
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Pricing Model")] }),
      new Table({
        width: { size: 9840, type: WidthType.DXA },
        columnWidths: [2200, 1600, 6040],
        rows: [
          new TableRow({ children: [
            makeCell("Tier", 2200, { bold: true, shading: ACCENT, color: "FFFFFF" }),
            makeCell("Monthly", 1600, { bold: true, shading: ACCENT, color: "FFFFFF" }),
            makeCell("Includes", 6040, { bold: true, shading: ACCENT, color: "FFFFFF" }),
          ]}),
          new TableRow({ children: [
            makeCell("Scout", 2200, { bold: true }),
            makeCell("$2,500", 1600, { bold: true }),
            makeCell("Monitoring + sentiment only. 2 topics. No meme generation.", 6040),
          ]}),
          new TableRow({ children: [
            makeCell("Creator", 2200, { bold: true, shading: LIGHT_BG }),
            makeCell("$7,500", 1600, { bold: true, shading: LIGHT_BG }),
            makeCell("Full pipeline. 5 topics, 3 characters, 100 generated memes/mo.", 6040, { shading: LIGHT_BG }),
          ]}),
          new TableRow({ children: [
            makeCell("Command", 2200, { bold: true }),
            makeCell("$15,000", 1600, { bold: true }),
            makeCell("Unlimited everything. Dedicated support, custom integrations, X/Twitter premium API.", 6040),
          ]}),
        ]
      }),
      new Paragraph({ spacing: { before: 100, after: 200 }, children: [
        new TextRun({ text: "Setup fee: $5,000\u201315,000 (content indexing, character creation, platform integration). Additional properties: $3,000 each.", size: 18, font: "Arial", color: "666666", italics: true })
      ]}),

      // Page break
      new Paragraph({ children: [new PageBreak()] }),

      // Financial Projections
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3-Year Financial Projections")] }),
      new Table({
        width: { size: 9840, type: WidthType.DXA },
        columnWidths: [3200, 2213, 2213, 2214],
        rows: [
          new TableRow({ children: [
            makeCell("", 3200, { shading: ACCENT }),
            makeCell("Year 1", 2213, { bold: true, shading: ACCENT, color: "FFFFFF", align: AlignmentType.CENTER }),
            makeCell("Year 2", 2213, { bold: true, shading: ACCENT, color: "FFFFFF", align: AlignmentType.CENTER }),
            makeCell("Year 3", 2214, { bold: true, shading: ACCENT, color: "FFFFFF", align: AlignmentType.CENTER }),
          ]}),
          ...[
            ["Clients", "2", "8", "20"],
            ["Recurring Revenue", "$180,000", "$720,000", "$2,400,000"],
            ["Setup Fees", "$20,000", "$60,000", "$150,000"],
            ["Total Revenue", "$200,000", "$780,000", "$2,550,000"],
            ["Total Costs", "$27,000", "$264,000", "$852,000"],
            ["Net Income", "$173,000", "$516,000", "$1,698,000"],
            ["Margin", "87%", "66%", "67%"],
          ].map((row, i) => new TableRow({ children: [
            makeCell(row[0], 3200, { bold: row[0] === "Net Income" || row[0] === "Total Revenue", shading: i % 2 === 0 ? LIGHT_BG : undefined }),
            makeCell(row[1], 2213, { bold: row[0] === "Net Income" || row[0] === "Total Revenue", align: AlignmentType.CENTER, shading: i % 2 === 0 ? LIGHT_BG : undefined }),
            makeCell(row[2], 2213, { bold: row[0] === "Net Income" || row[0] === "Total Revenue", align: AlignmentType.CENTER, shading: i % 2 === 0 ? LIGHT_BG : undefined }),
            makeCell(row[3], 2214, { bold: row[0] === "Net Income" || row[0] === "Total Revenue", align: AlignmentType.CENTER, shading: i % 2 === 0 ? LIGHT_BG : undefined }),
          ]})),
        ]
      }),

      // Current State
      new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300 }, children: [new TextRun("Current State")] }),
      ...[
        "MVP deployed and operational at flyingunit.com",
        "YouTube, Imgur, and Hacker News adapters live; Reddit pending API approval",
        "100+ meme templates fingerprinted with perceptual hashing",
        "Gemini Vision meme analysis identifying templates, humor types, and sentiment",
        "3 properties already indexed: Wayfinders S01, Wingfeather S03, Homestead S01",
        "Character system and automated end-to-end pipeline built and deployed",
      ].map(t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 50 }, children: [new TextRun({ text: t, size: 20, font: "Arial" })] })),

      // Risks
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Key Risks & Mitigations")] }),
      ...[
        "Platform API changes \u2014 mitigated by multi-platform architecture with adapter abstraction",
        "Content licensing concerns \u2014 mitigated by using only the client\u2019s own IP",
        "Competition from Brandwatch/Meltwater \u2014 differentiated by meme generation from source footage (unique capability)",
      ].map(t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 20, font: "Arial" })] })),

      // Next Steps
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Immediate Next Steps")] }),
      ...[
        "Close Angel Studios as founding client with Wayfinders Season 2 launch package",
        "Index Season 2 footage upon delivery (48-hour turnaround)",
        "Expand platform coverage to X/Twitter, TikTok, and Instagram",
        "Build self-service onboarding for Scout tier clients",
      ].map((t, i) => new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 20, font: "Arial" })] })),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/Users/JERS/flyingtheunit/docs/The_Unit_Executive_Summary.docx", buffer);
  console.log("Executive Summary created.");
});
