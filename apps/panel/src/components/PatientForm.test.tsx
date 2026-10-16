import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PatientForm from "./PatientForm";

const setup = () => {
  const onSubmit = vi.fn();
  render(<PatientForm submitLabel="Guardar" busy={false} onSubmit={onSubmit} onCancel={() => {}} />);
  return onSubmit;
};

describe("PatientForm", () => {
  it("muestra errores junto a cada campo y no envia datos invalidos", () => {
    const onSubmit = setup();
    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Al" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByLabelText("Nombre completo")).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("envia datos normalizados cuando son validos y los opcionales vacios quedan en null", () => {
    const onSubmit = setup();
    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "  Ana María Pérez " } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "7 123-4567" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSubmit).toHaveBeenCalledWith({ fullName: "Ana María Pérez", phone: "71234567", birthDate: null, email: null });
  });

  it("rechaza correos mal escritos", () => {
    const onSubmit = setup();
    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Ana Pérez" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "71234567" } });
    fireEvent.change(screen.getByLabelText("Correo (opcional)"), { target: { value: "no-es-correo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Correo inválido");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
