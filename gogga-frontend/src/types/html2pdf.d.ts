/**
 * Type declarations for html2pdf.js
 * @see https://ekoopmans.github.io/html2pdf.js/
 */

declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    pagebreak?: {
      mode?: string | string[];
      before?: string | string[];
      after?: string | string[];
      avoid?: string | string[];
    };
    image?: {
      type?: 'jpeg' | 'png' | 'webp';
      quality?: number;
    };
    enableLinks?: boolean;
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      logging?: boolean;
      letterRendering?: boolean;
      backgroundColor?: string;
      foreignObjectRendering?: boolean;
      allowTaint?: boolean;
      imageTimeout?: number;
      removeContainer?: boolean;
      onclone?: (document: Document) => void;
    };
    jsPDF?: {
      unit?: 'pt' | 'mm' | 'cm' | 'in';
      format?: 'a0' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8' | 'a9' | 'a10' |
               'b0' | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8' | 'b9' | 'b10' |
               'letter' | 'legal' | 'tabloid' | 'ledger' | 'executive' | 'folio' |
               [number, number];
      orientation?: 'portrait' | 'landscape' | 'p' | 'l';
      compress?: boolean;
      hotfixes?: string[];
    };
  }

  interface Html2PdfWorker {
    from(element: HTMLElement | string, type?: 'element' | 'string' | 'canvas' | 'img'): Html2PdfWorker;
    to(target: 'container' | 'canvas' | 'img' | 'pdf'): Html2PdfWorker;
    toContainer(): Html2PdfWorker;
    toCanvas(): Html2PdfWorker;
    toImg(): Html2PdfWorker;
    toPdf(): Html2PdfWorker;
    output(type?: string, options?: Record<string, unknown>, src?: 'pdf' | 'img'): Promise<unknown>;
    outputPdf(type?: string, options?: Record<string, unknown>): Promise<unknown>;
    outputImg(type?: string, options?: Record<string, unknown>): Promise<unknown>;
    save(filename?: string): Promise<void>;
    saveAs(filename?: string): Promise<void>;
    set(opt: Html2PdfOptions): Html2PdfWorker;
    using(opt: Html2PdfOptions): Html2PdfWorker;
    get(key: string, callback?: (value: unknown) => void): Promise<unknown> | Html2PdfWorker;
    then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown): Html2PdfWorker;
    thenCore(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown): Html2PdfWorker;
    thenExternal(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown): Promise<unknown>;
    catch(onRejected?: (reason: unknown) => unknown): Html2PdfWorker;
    catchExternal(onRejected?: (reason: unknown) => unknown): Promise<unknown>;
    error(msg: string): Html2PdfWorker;
  }

  function html2pdf(): Html2PdfWorker;
  function html2pdf(element: HTMLElement, options?: Html2PdfOptions): Promise<void>;
  
  export = html2pdf;
}
