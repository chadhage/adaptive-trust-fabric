import argparse
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

import pymupdf

PUBLIC_BASE = "https://chadhage.github.io/adaptive-trust-fabric/"


def normalized(value):
    value = unicodedata.normalize("NFKC", value).replace("\u00ad", "")
    value = re.sub(r"(?<=\w)-[ \t]*\r?\n\s*(?=\w)", "-", value)
    return re.sub(r"\s+", " ", value).strip()


def rebase_publication_links(pdf_path):
    root = Path(__file__).resolve().parents[1].as_posix().rstrip("/") + "/"
    prefixes = [root, "/" + root.lstrip("/")]
    changed = 0
    rewritten = None
    with pymupdf.open(pdf_path) as document:
        for page in document:
            for link in page.get_links():
                target = link.get("uri", link.get("file", ""))
                if target.startswith("file:"):
                    parsed = urlsplit(target)
                    target = parsed.path + ("#" + parsed.fragment if parsed.fragment else "")
                target = unquote(target).replace("\\", "/")
                prefix = next((value for value in prefixes if target.casefold().startswith(value.casefold())), None)
                if prefix:
                    relative = target[len(prefix):]
                    page.update_link({
                        "kind": pymupdf.LINK_URI,
                        "from": link["from"],
                        "uri": PUBLIC_BASE + quote(relative, safe="/#?=&%"),
                        "xref": link["xref"],
                    })
                    changed += 1
        if changed:
            rewritten = document.tobytes(garbage=4, deflate=True)
    if rewritten is not None:
        pdf_path.write_bytes(rewritten)
    return changed


def inspect_pdf(pdf_path, research_path):
    research = json.loads(research_path.read_text(encoding="utf-8"))
    errors = []
    pages = []
    publication_links = 0
    local_file_links = 0
    with pymupdf.open(pdf_path) as document:
        text = "\n".join(page.get_text(sort=False) for page in document)
        searchable = normalized(text)
        for number, page in enumerate(document, start=1):
            page_text = page.get_text()
            words = len(page_text.split())
            pages.append({
                "page": number,
                "words": words,
                "width_pt": round(page.rect.width, 2),
                "height_pt": round(page.rect.height, 2),
                "first_text": normalized(page_text)[:120],
            })
            if words < 10:
                errors.append(f"Page {number} is blank or unexpectedly sparse ({words} words).")
            if abs(page.rect.width - 595.28) > 2 or abs(page.rect.height - 841.89) > 2:
                errors.append(f"Page {number} is not A4 portrait.")
            for link in page.get_links():
                target = link.get("uri", link.get("file", ""))
                if target.startswith(PUBLIC_BASE):
                    publication_links += 1
                if link["kind"] == pymupdf.LINK_LAUNCH or target.startswith("file:"):
                    local_file_links += 1
            for block in page.get_text("blocks"):
                if block[0] < -1 or block[1] < -1 or block[2] > page.rect.width + 1 or block[3] > page.rect.height + 1:
                    errors.append(f"Page {number} has text outside its page bounds.")
                    break
        missing_controls = []
        for control in research["normativeControls"]:
            if not re.search(rf"\b{re.escape(control['id'])}\b", searchable):
                missing_controls.append(control["id"])
            if normalized(control["text"]) not in searchable:
                errors.append(f"PDF lacks complete canonical core wording for {control['id']}.")
        for source in research["sources"]:
            if source["id"] not in searchable:
                errors.append(f"PDF lacks source identifier {source['id']}.")
        for phrase in [
            "Candidate", "Insufficient evidence", "Excluded",
            "initial recovery", "logical agent", "not performed",
        ]:
            if phrase.casefold() not in searchable.casefold():
                errors.append(f"PDF lacks required publication qualification: {phrase}.")
        if missing_controls:
            errors.append(f"PDF lacks control IDs: {', '.join(missing_controls)}.")
        if local_file_links:
            errors.append(f"PDF contains {local_file_links} nonportable local-file links.")
        return {
            "pdf": str(pdf_path),
            "pages": pages,
            "page_count": len(document),
            "control_count": len(research["normativeControls"]),
            "source_count": len(research["sources"]),
            "missing_controls": missing_controls,
            "publication_links": publication_links,
            "local_file_links": local_file_links,
            "errors": errors,
            "qualification": "Local publication checks only; operational/lab validation not performed.",
        }


def main():
    parser = argparse.ArgumentParser(description="Inspect the generated paper's real PDF text and A4 pagination.")
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--research", type=Path, required=True)
    parser.add_argument("--rebase-links", action="store_true", help="Replace checkout-specific links with public project URLs before inspection.")
    arguments = parser.parse_args()
    rebased = rebase_publication_links(arguments.pdf) if arguments.rebase_links else 0
    report = inspect_pdf(arguments.pdf, arguments.research)
    if arguments.rebase_links:
        report["rebased_links"] = rebased
    print(json.dumps(report, ensure_ascii=False))
    raise SystemExit(1 if report["errors"] else 0)


if __name__ == "__main__":
    main()
