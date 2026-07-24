import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

export async function GET(
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

    // Creazione del documento PDF in memoria tramite PDFKit
    // IMPORTANTE: Assenza totale di dati (nomi/ID) di profili bambino per garantire la Privacy by Design.
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    // --- Intestazione Documento ---
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#6366f1")
      .text("STORIIA • RACCONTI SU MISURA PER CRESCERE", { align: "left" });
    doc.moveDown(0.4);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#0f172a")
      .text(title, { align: "left" });
    doc.moveDown(0.4);

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#64748b")
      .text(`Generato il: ${dateStr} | Fascia d'età target: ${ageRange} anni`, { align: "left" });
    doc.moveDown(0.6);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cbd5e1").lineWidth(1).stroke();
    doc.moveDown(1.4);

    // --- Corpo della Storia ---
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#1e293b")
      .text(bodyText, { align: "justify", lineGap: 6 });

    // --- Sezione Morale (se disponibile) ---
    if (moralTitle || moralDescription) {
      doc.moveDown(1.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      doc.moveDown(0.8);

      if (moralTitle) {
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor("#4338ca")
          .text(`✨ INSEGNAMENTO DEL RACCONTO: ${moralTitle}`, { align: "left" });
        doc.moveDown(0.3);
      }
      if (moralDescription) {
        doc
          .font("Helvetica-Oblique")
          .fontSize(10)
          .fillColor("#334155")
          .text(moralDescription, { align: "left" });
      }
    }

    // --- Piè di Pagina e Numerazione ---
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#94a3b8")
        .text(
          `StoriIA • Documento generato per uso familiare e didattico — Pagina ${i + 1} di ${pages.count}`,
          50,
          doc.page.height - 35,
          { align: "center", width: doc.page.width - 100 }
        );
    }

    doc.end();
    const pdfBuffer = await pdfBufferPromise;

    const cleanFilename = title
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .substring(0, 40);

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="StoriIA_${cleanFilename || "Racconto"}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore durante la generazione del PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
