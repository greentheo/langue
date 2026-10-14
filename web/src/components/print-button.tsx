"use client";

/** Print the page — the certificate is laid out to print on one sheet. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="crt-button">
      Print
    </button>
  );
}
