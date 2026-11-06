import assert from "node:assert/strict";
import test from "node:test";
import { titleFromApostilaText } from "../src/lib/apostilaTitle";

test("usa a disciplina impressa, mesmo com capa sem texto", () => {
  const text = "\n\n \n\nAcademia Estadual de Segurança Pública do Ceará\nPOLICIAMENTO COMUNITÁRIO\n1\nGOVERNO DO ESTADO DO CEARÁ\nDISICPLINA\nPoliciamento Comunitário\nCONTEUDISTA\n";
  assert.equal(titleFromApostilaText(text, "Apostila 2"), "Policiamento Comunitário");
});

test("aceita título na mesma linha do rótulo", () => {
  assert.equal(titleFromApostilaText("TÍTULO: Psicologia das Emergências\nIntrodução"), "Psicologia das Emergências");
});

test("usa o cabeçalho da capa quando não há rótulo", () => {
  assert.equal(titleFromApostilaText("ACADEMIA ESTADUAL\nDEONTOLOGIA POLICIAL\n1\n"), "DEONTOLOGIA POLICIAL");
});

test("recorre aos metadados sem inventar título", () => {
  assert.equal(titleFromApostilaText("\n\n", "Direitos Humanos"), "Direitos Humanos");
  assert.equal(titleFromApostilaText("\n\n", "Apostila 2"), null);
});
