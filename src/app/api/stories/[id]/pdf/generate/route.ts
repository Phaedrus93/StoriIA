import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const dynamic = "force-dynamic";

function cleanForWinAnsi(text: string): string {
  // Rimuove emoji e caratteri non supportati dalla tabella WinAnsi (Windows-1252) usata da Helvetica in pdf-lib
  return text.replace(/[^\x00-\xFF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/g, "");
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const clean = cleanForWinAnsi(text);
  const lines: string[] = [];
  const paragraphs = clean.split(/\r?\n/);

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID storia mancante" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Query della storia con LEFT JOIN su families (per le storie preset con family_id = NULL)
    // e opzionalmente su moral_lessons
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select("*, families(parent_user_id), moral_lessons(label, title, description)")
      .eq("id", id)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Storia non trovata" }, { status: 404 });
    }

    // Controllo di titolarità condizionale:
    // Se la storia è ai_generated, solo il genitore proprietario della famiglia associata può scaricarla.
    // Se la storia è preset, qualunque genitore autenticato può scaricare il documento.
    if (story.source === "ai_generated") {
      const ownerId = story.families?.parent_user_id;
      if (!ownerId || ownerId !== user.id) {
        return NextResponse.json(
          { error: "Accesso negato: il documento appartiene a un'altra famiglia" },
          { status: 403 }
        );
      }
    }

    const adminClient = createAdminClient();

    // Se esiste già un pdf_storage_path salvato, restituisci direttamente una signed URL fresca (5 minuti)
    if (story.pdf_storage_path) {
      const { data: signedData, error: signErr } = await adminClient
        .storage
        .from("story-pdfs")
        .createSignedUrl(story.pdf_storage_path, 300);

      if (!signErr && signedData?.signedUrl) {
        return NextResponse.json({
          signedUrl: signedData.signedUrl,
          storagePath: story.pdf_storage_path,
          cached: true,
        });
      }
      // Se il file è mancante nello storage o la firma fallisce pur essendo in DB, procediamo a rigenerare.
    }

    // Estrazione pulita di Titolo e Testo (gestendo sia accapo reali che letterali \n dal DB)
    const rawText = (story.generated_text || "").trim();
    const normalizedText = rawText.replace(/\\n/g, "\n");
    const lines = normalizedText.split(/\r?\n/);
    let title = "Racconto Magico StoriIA";
    let bodyText = normalizedText;

    if (lines[0] && lines[0].trim().startsWith("#")) {
      title = lines[0].replace(/^#+\s*/, "").trim();
      bodyText = lines.slice(1).join("\n").trim();
    } else if (lines[0] && lines[0].length < 80 && lines.length > 1) {
      title = lines[0].trim();
      bodyText = lines.slice(1).join("\n").trim();
    }

    const dateStr = new Date(story.created_at || Date.now()).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const ageRange = story.target_age_range || "4-6";
    const moralTitle = story.moral_lessons?.title || null;
    const moralDescription = story.moral_lessons?.description || null;

    // Generazione PDF con pdf-lib (in memoria)
    // IMPORTANTE: Assenza totale di dati (nomi/ID) di profili bambino per garantire la Privacy by Design.
    const doc = await PDFDocument.create();
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;
    const maxWidth = pageWidth - margin * 2;

    let page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const checkPageBreak = (neededHeight: number) => {
      if (y - neededHeight < margin + 30) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    // --- Intestazione Documento ---
    page.drawText(cleanForWinAnsi("STORIIA • RACCONTI SU MISURA PER CRESCERE"), {
      x: margin,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: rgb(0.388, 0.4, 0.945),
    });
    y -= 25;

    const titleLines = wrapText(title, fontBold, 20, maxWidth);
    for (const tLine of titleLines) {
      checkPageBreak(25);
      page.drawText(tLine, {
        x: margin,
        y: y - 20,
        size: 20,
        font: fontBold,
        color: rgb(0.058, 0.09, 0.164),
      });
      y -= 25;
    }
    y -= 5;

    const metaStr = cleanForWinAnsi(`Generato il: ${dateStr} | Fascia d'età target: ${ageRange} anni`);
    page.drawText(metaStr, {
      x: margin,
      y: y - 10,
      size: 10,
      font: fontRegular,
      color: rgb(0.392, 0.454, 0.545),
    });
    y -= 20;

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.796, 0.835, 0.882),
    });
    y -= 25;

    // --- Corpo del testo ---
    const bodyLines = wrapText(bodyText, fontRegular, 12, maxWidth);
    for (const bLine of bodyLines) {
      checkPageBreak(16);
      if (bLine !== "") {
        page.drawText(bLine, {
          x: margin,
          y: y - 12,
          size: 12,
          font: fontRegular,
          color: rgb(0.117, 0.16, 0.231),
        });
      }
      y -= 16;
    }

    // --- Sezione Morale ---
    if (moralTitle || moralDescription) {
      checkPageBreak(60);
      y -= 15;
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 0.5,
        color: rgb(0.886, 0.909, 0.941),
      });
      y -= 20;

      if (moralTitle) {
        const moralHeaderLines = wrapText(`* INSEGNAMENTO DEL RACCONTO: ${moralTitle}`, fontBold, 11, maxWidth);
        for (const mhLine of moralHeaderLines) {
          checkPageBreak(16);
          page.drawText(mhLine, {
            x: margin,
            y: y - 11,
            size: 11,
            font: fontBold,
            color: rgb(0.262, 0.219, 0.792),
          });
          y -= 16;
        }
        y -= 4;
      }

      if (moralDescription) {
        const moralDescLines = wrapText(moralDescription, fontOblique, 10, maxWidth);
        for (const mdLine of moralDescLines) {
          checkPageBreak(14);
          page.drawText(mdLine, {
            x: margin,
            y: y - 10,
            size: 10,
            font: fontOblique,
            color: rgb(0.2, 0.254, 0.333),
          });
          y -= 14;
        }
      }
    }

    // --- Piè di pagina numerato ---
    const pages = doc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const footerText = cleanForWinAnsi(`StoriIA • Documento generato per uso familiare e didattico — Pagina ${i + 1} di ${pages.length}`);
      const footerWidth = fontRegular.widthOfTextAtSize(footerText, 8);
      p.drawText(footerText, {
        x: (pageWidth - footerWidth) / 2,
        y: 25,
        size: 8,
        font: fontRegular,
        color: rgb(0.58, 0.639, 0.721),
      });
    }

    const pdfBytes = await doc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const cleanFilename = title
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .substring(0, 40) || "Racconto";
    const storagePath = `stories/${id}/${cleanFilename}.pdf`;

    // Caricamento nel bucket privato tramite adminClient (service_role)
    const { error: uploadErr } = await adminClient
      .storage
      .from("story-pdfs")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Errore caricamento su storage: ${uploadErr.message}`);
    }

    // Aggiornamento path in stories
    await adminClient
      .from("stories")
      .update({ pdf_storage_path: storagePath })
      .eq("id", id);

    // Emissione della signed URL fresca (5 minuti = 300s)
    const { data: signedData, error: signErr } = await adminClient
      .storage
      .from("story-pdfs")
      .createSignedUrl(storagePath, 300);

    if (signErr || !signedData?.signedUrl) {
      throw new Error("Errore durante la generazione della signed URL");
    }

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      storagePath,
      cached: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore durante la generazione del PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
