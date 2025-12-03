/**
 * Type declarations for bwip-js
 * @see https://github.com/metafloor/bwip-js
 */

declare module "bwip-js" {
  interface BwipOptions {
    /** Barcode type identifier */
    bcid: string;
    /** Data to encode */
    text: string;
    /** Scale factor (default: 2) */
    scale?: number;
    /** Height in mm */
    height?: number;
    /** Width in mm */
    width?: number;
    /** Bar color (hex without #) */
    barcolor?: string;
    /** Background color (hex without #) */
    backgroundcolor?: string;
    /** Include human-readable text */
    includetext?: boolean;
    /** Text horizontal alignment */
    textxalign?: "offleft" | "left" | "center" | "right" | "offright" | "justify";
    /** Text vertical alignment */
    textyalign?: "below" | "center" | "above";
    /** Text font size */
    textsize?: number;
    /** Padding around barcode */
    padding?: number;
    /** Rotation angle */
    rotate?: "N" | "R" | "L" | "I";
  }

  /** Options for toBuffer (Node.js) - extends BwipOptions */
  interface ToBufferOptions extends BwipOptions {
    // toBuffer specific options can be added here
  }

  interface BwipJs {
    /** Generate barcode as PNG buffer (Node.js only) */
    toBuffer(options: ToBufferOptions): Promise<Buffer>;
    /** Generate barcode to canvas (browser - synchronous) */
    toCanvas(canvas: HTMLCanvasElement, options: BwipOptions): void;
    /** Generate barcode as data URL */
    toDataURL(options: BwipOptions): Promise<string>;
  }

  const bwipjs: BwipJs;
  export default bwipjs;
  export { BwipOptions, ToBufferOptions, BwipJs };
}
