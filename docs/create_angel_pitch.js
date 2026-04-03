const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };
const ACCENT = "1A3C6E";
const HIGHLIGHT = "2D6A4F";
const LIGHT_BG = "EDF2F7";

function makeCell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold || false, size: opts.size || 20, font: "Arial", color: opts.color || "333333" })]
    })],
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 300, after: 180 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
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
            new TextRun({ text: "THE UNIT ", bold: true, size: 18, font: "Arial", color: ACCENT }),
            new TextRun({ text: "\u00D7 ", size: 18, font: "Arial", color: "999999" }),
            new TextRun({ text: "ANGEL STUDIOS", bold: true, size: 18, font: "Arial", color: ACCENT }),
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
      // Title block
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: "THE UNIT \u00D7 ANGEL STUDIOS", bold: true, size: 44, font: "Arial", color: ACCENT })]
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: "Automated Meme Intelligence for The Wayfinders Season 2", size: 26, font: "Arial", color: "666666", italics: true })]
      }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 8 } },
        spacing: { after: 240 },
        children: []
      }),

      // Opening
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: "The Wayfinders Season 1 generated massive organic fan engagement. Season 2 will be bigger. But right now, ", size: 21, font: "Arial" }),
          new TextRun({ text: "you\u2019re leaving engagement on the table", bold: true, size: 21, font: "Arial" }),
          new TextRun({ text: " \u2014 fans are making memes, having conversations, and building hype across YouTube, Reddit, TikTok, and Instagram, and your team can\u2019t respond fast enough.", size: 21, font: "Arial" }),
        ]
      }),
      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun({ text: "The Unit changes that.", bold: true, size: 24, font: "Arial", color: ACCENT })]
      }),

      // How it works
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("How It Works")] }),
      new Paragraph({ spacing: { after: 120 }, children: [
        new TextRun({ text: "The Unit monitors every conversation about The Wayfinders across social media in real-time. When a fan posts a meme about the show, The Unit automatically:", size: 21, font: "Arial" })
      ]}),

      ...[
        { num: "DETECTS", desc: " the meme within minutes of posting across YouTube, Reddit, Imgur, and more" },
        { num: "IDENTIFIES", desc: " the meme template (Drake, Distracted Boyfriend, etc.) and analyzes sentiment \u2014 celebrating or criticizing?" },
        { num: "MATCHES", desc: " scenes from your actual Wayfinders footage. Every scene in Season 1 is already indexed \u2014 characters, emotions, dialogue, visual gags \u2014 all searchable by mood." },
        { num: "GENERATES", desc: " a response meme using YOUR characters, YOUR footage, in the voice of custom brand personas you create" },
        { num: "QUEUES", desc: " it for your team\u2019s approval (or posts automatically once you\u2019re comfortable)" },
      ].map(item => new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: item.num, bold: true, size: 21, font: "Arial", color: ACCENT }),
          new TextRun({ text: item.desc, size: 21, font: "Arial" }),
        ]
      })),

      // Example scenario
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Example Scenario")] }),
      new Paragraph({
        spacing: { after: 100 },
        shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
        indent: { left: 360, right: 360 },
        children: [
          new TextRun({ text: "A Reddit user posts a \u201CDrake Hotline Bling\u201D meme:\n", size: 20, font: "Arial", italics: true }),
        ]
      }),
      new Paragraph({
        spacing: { after: 100 },
        shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
        indent: { left: 720, right: 360 },
        children: [
          new TextRun({ text: "Top: ", bold: true, size: 20, font: "Arial" }),
          new TextRun({ text: "\u201CWatching another generic fantasy show\u201D", size: 20, font: "Arial", italics: true }),
        ]
      }),
      new Paragraph({
        spacing: { after: 200 },
        shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
        indent: { left: 720, right: 360 },
        children: [
          new TextRun({ text: "Bottom: ", bold: true, size: 20, font: "Arial" }),
          new TextRun({ text: "\u201CWatching The Wayfinders for the 5th time\u201D", size: 20, font: "Arial", italics: true }),
        ]
      }),
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({ text: "The Unit detects this within 15 minutes. It identifies the Drake template. It searches Season 1 and finds a scene of a character looking unimpressed (panel 1) and the team\u2019s triumphant moment (panel 2). It generates a response from your character account \u201CWayfinderFanatic\u201D with text tailored to that conversation. Your team approves with one click. Posted as a reply within the hour.", size: 20, font: "Arial" }),
        ]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: "The result: fans see the property engaging WITH their memes using actual show footage. ", bold: true, size: 21, font: "Arial" }),
          new TextRun({ text: "No other studio is doing this.", bold: true, size: 21, font: "Arial", color: ACCENT }),
        ]
      }),

      // Why Now
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Why Now \u2014 Season 2")] }),
      ...[
        "Season 1 is already fully indexed in our system. Season 2 can be indexed within 48 hours of footage delivery.",
        "The pre-release hype window is the highest-value time for meme engagement.",
        "Organic fan memes during S2 will be 3\u20135x Season 1 based on typical franchise growth curves.",
        "First-mover advantage: no other studio is doing automated meme responses with their own footage.",
      ].map(t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 20, font: "Arial" })] })),

      // Page break
      new Paragraph({ children: [new PageBreak()] }),

      // What's Already Built
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("What\u2019s Already Built")] }),
      ...[
        "The Wayfinders Season 1: all episodes indexed with 42+ metadata fields per scene",
        "48+ social media posts already collected and analyzed about The Wayfinders",
        "100+ meme templates fingerprinted and ready for matching",
        "Sentiment analysis, entity extraction, and cross-platform monitoring live",
        "Character system ready for Angel Studios to create branded personas",
      ].map(t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 20, font: "Arial" })] })),

      // Pricing
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("The Wayfinders Season 2 Launch Package")] }),

      new Table({
        width: { size: 9840, type: WidthType.DXA },
        columnWidths: [4920, 4920],
        rows: [
          new TableRow({ children: [
            makeCell("Component", 4920, { bold: true, shading: ACCENT, color: "FFFFFF" }),
            makeCell("Details", 4920, { bold: true, shading: ACCENT, color: "FFFFFF" }),
          ]}),
          new TableRow({ children: [
            makeCell("One-Time Setup", 4920, { bold: true }),
            makeCell("$10,000 \u2014 Index S2 footage (48hr), create 3\u20134 character personas, configure platforms, train team", 4920),
          ]}),
          new TableRow({ children: [
            makeCell("Monthly (Creator Tier)", 4920, { bold: true, shading: LIGHT_BG }),
            makeCell("$7,500/mo \u2014 5 topics, 3 characters, 100 memes/mo, sentiment dashboard, weekly reports", 4920, { shading: LIGHT_BG }),
          ]}),
          new TableRow({ children: [
            makeCell("Annual Commitment", 4920, { bold: true }),
            makeCell("$90,000/yr + $10,000 setup = $100,000 Year 1", 4920),
          ]}),
        ]
      }),

      // Founding offer
      new Paragraph({ spacing: { before: 240, after: 120 }, children: [
        new TextRun({ text: "FOUNDING CLIENT OFFER", bold: true, size: 24, font: "Arial", color: HIGHLIGHT })
      ]}),
      new Paragraph({
        spacing: { after: 60 },
        shading: { fill: "E8F5E9", type: ShadingType.CLEAR },
        indent: { left: 360, right: 360 },
        children: [new TextRun({ text: "First 3 months at $5,000/mo (then $7,500/mo) + setup fee waived", bold: true, size: 21, font: "Arial" })]
      }),
      new Paragraph({
        spacing: { after: 60 },
        shading: { fill: "E8F5E9", type: ShadingType.CLEAR },
        indent: { left: 360, right: 360 },
        children: [new TextRun({ text: "Year 1 actual: $82,500 (saving $27,500)", size: 21, font: "Arial", bold: true, color: HIGHLIGHT })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        shading: { fill: "E8F5E9", type: ShadingType.CLEAR },
        indent: { left: 360, right: 360 },
        children: [new TextRun({ text: "In exchange: case study rights + testimonial for future sales", size: 20, font: "Arial", italics: true })]
      }),

      // ROI
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Return on Investment")] }),
      ...[
        "A single viral meme response using real show footage can generate 100K+ impressions",
        "At 10 responses/week \u00D7 52 weeks = 520 brand touchpoints per year",
        "Average social media agency charges $5,000\u201315,000/mo for manual posting",
        "The Unit automates what would require a 2-person social team",
        "Cost per engagement will be a fraction of paid social advertising",
      ].map(t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 20, font: "Arial" })] })),

      // Next Steps
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Next Steps")] }),
      ...[
        "30-minute demo of The Unit with live Wayfinders data (available this week)",
        "Angel Studios provides Season 2 early footage for indexing",
        "Collaborative character creation workshop (2 hours)",
        "Live within 1 week of footage delivery",
      ].map((t, i) => new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: t, size: 21, font: "Arial" })]
      })),

      // Contact
      new Paragraph({ spacing: { before: 300 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 8 } }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120 },
        children: [
          new TextRun({ text: "Ready to turn fan memes into marketing gold?", bold: true, size: 24, font: "Arial", color: ACCENT }),
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
        children: [
          new TextRun({ text: "flyingunit.com  |  Elliot Stivers  |  elliots@gmail.com", size: 20, font: "Arial", color: "666666" }),
        ]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/Users/JERS/flyingtheunit/docs/The_Unit_Angel_Studios_Pitch.docx", buffer);
  console.log("Angel Studios pitch created.");
});
