import { describe, expect, it } from "vitest";
import { checkFile, formatBytes } from "./documents";

describe("checkFile", () => {
  it("acepta PDF e imagenes dentro del limite", () => {
    expect(checkFile({ type: "application/pdf", size: 500_000, name: "a.pdf" })).toBeNull();
    expect(checkFile({ type: "image/jpeg", size: 9_000_000, name: "a.jpg" })).toBeNull(); // las fotos se reducen antes de subir
  });
  it("rechaza tipos no permitidos y archivos vacios", () => {
    expect(checkFile({ type: "application/zip", size: 100, name: "a.zip" })).toMatch(/Solo se aceptan/);
    expect(checkFile({ type: "application/pdf", size: 0, name: "a.pdf" })).toMatch(/vacío/);
  });
  it("un PDF demasiado grande dice cuanto pesa y cual es el maximo", () => {
    const msg = checkFile({ type: "application/pdf", size: 3 * 1024 * 1024, name: "a.pdf" });
    expect(msg).toContain("3.0 MB");
    expect(msg).toContain("2.0 MB");
  });
});

describe("formatBytes", () => {
  it("formatea B, KB y MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1_572_864)).toBe("1.5 MB");
  });
});
