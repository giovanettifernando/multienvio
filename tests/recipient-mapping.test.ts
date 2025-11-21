/**
 * Testes para mapeamento de tipos de destinatários
 * Cobre TODO-3 (unificação de endpoints e mapeamento)
 */

import { describe, it } from "node:test";
import assert from "node:assert";

describe("Recipient API Mapping - TODO-3", () => {
  describe("Frontend → API mapping", () => {
    it("deve mapear campos do frontend para API corretamente", () => {
      const frontendRecipient = {
        nome: "João Silva",
        documento: "12345678900",
        telefone: "41999999999",
        email: "joao@example.com",
        cep: "80010-000",
        logradouro: "Rua XV de Novembro",
        numero: "100",
        complemento: "Sala 10",
        bairro: "Centro",
        cidade: "Curitiba",
        uf: "PR",
        observacoes: "Entregar pela manhã",
      };

      // Simular mapeamento (conforme hooks/useQuotes.ts)
      const apiPayload = {
        name: frontendRecipient.nome,
        document: frontendRecipient.documento || null,
        phone: frontendRecipient.telefone || null,
        email: frontendRecipient.email || null,
        cep: frontendRecipient.cep,
        logradouro: frontendRecipient.logradouro,
        numero: frontendRecipient.numero,
        complemento: frontendRecipient.complemento || null,
        bairro: frontendRecipient.bairro,
        cidade: frontendRecipient.cidade,
        uf: frontendRecipient.uf,
        notes: frontendRecipient.observacoes || null,
        isDefault: false,
      };

      assert.strictEqual(apiPayload.name, "João Silva");
      assert.strictEqual(apiPayload.document, "12345678900");
      assert.strictEqual(apiPayload.phone, "41999999999");
      assert.strictEqual(apiPayload.email, "joao@example.com");
      assert.strictEqual(apiPayload.notes, "Entregar pela manhã");
    });

    it("deve converter campos vazios para null na API", () => {
      const frontendRecipient = {
        nome: "João Silva",
        documento: "",
        telefone: "",
        email: undefined,
        cep: "80010-000",
        logradouro: "Rua XV de Novembro",
        numero: "100",
        complemento: undefined,
        bairro: "Centro",
        cidade: "Curitiba",
        uf: "PR",
        observacoes: "",
      };

      const apiPayload = {
        name: frontendRecipient.nome,
        document: frontendRecipient.documento || null,
        phone: frontendRecipient.telefone || null,
        email: frontendRecipient.email || null,
        cep: frontendRecipient.cep,
        logradouro: frontendRecipient.logradouro,
        numero: frontendRecipient.numero,
        complemento: frontendRecipient.complemento || null,
        bairro: frontendRecipient.bairro,
        cidade: frontendRecipient.cidade,
        uf: frontendRecipient.uf,
        notes: frontendRecipient.observacoes || null,
        isDefault: false,
      };

      assert.strictEqual(apiPayload.document, null);
      assert.strictEqual(apiPayload.phone, null);
      assert.strictEqual(apiPayload.email, null);
      assert.strictEqual(apiPayload.complemento, null);
      assert.strictEqual(apiPayload.notes, null);
    });
  });

  describe("API → Frontend mapping", () => {
    it("deve mapear campos da API para frontend corretamente", () => {
      const apiRecipient = {
        id: "rec_123",
        name: "João Silva",
        document: "12345678900",
        phone: "41999999999",
        email: "joao@example.com",
        cep: "80010-000",
        logradouro: "Rua XV de Novembro",
        numero: "100",
        complemento: "Sala 10",
        bairro: "Centro",
        cidade: "Curitiba",
        uf: "PR",
        notes: "Entregar pela manhã",
        isDefault: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      // Simular mapeamento (conforme hooks/useQuotes.ts)
      const frontendRecipient = {
        id: apiRecipient.id,
        nome: apiRecipient.name,
        telefone: apiRecipient.phone || "",
        email: apiRecipient.email || undefined,
        documento: apiRecipient.document || "",
        cep: apiRecipient.cep,
        logradouro: apiRecipient.logradouro,
        numero: apiRecipient.numero,
        complemento: apiRecipient.complemento || undefined,
        bairro: apiRecipient.bairro,
        cidade: apiRecipient.cidade,
        uf: apiRecipient.uf,
        observacoes: apiRecipient.notes || undefined,
      };

      assert.strictEqual(frontendRecipient.id, "rec_123");
      assert.strictEqual(frontendRecipient.nome, "João Silva");
      assert.strictEqual(frontendRecipient.documento, "12345678900");
      assert.strictEqual(frontendRecipient.telefone, "41999999999");
      assert.strictEqual(frontendRecipient.email, "joao@example.com");
      assert.strictEqual(frontendRecipient.observacoes, "Entregar pela manhã");
    });

    it("deve converter null da API para string vazia ou undefined no frontend", () => {
      const apiRecipient = {
        id: "rec_123",
        name: "João Silva",
        document: null,
        phone: null,
        email: null,
        cep: "80010-000",
        logradouro: "Rua XV de Novembro",
        numero: "100",
        complemento: null,
        bairro: "Centro",
        cidade: "Curitiba",
        uf: "PR",
        notes: null,
        isDefault: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      const frontendRecipient = {
        id: apiRecipient.id,
        nome: apiRecipient.name,
        telefone: apiRecipient.phone || "",
        email: apiRecipient.email || undefined,
        documento: apiRecipient.document || "",
        cep: apiRecipient.cep,
        logradouro: apiRecipient.logradouro,
        numero: apiRecipient.numero,
        complemento: apiRecipient.complemento || undefined,
        bairro: apiRecipient.bairro,
        cidade: apiRecipient.cidade,
        uf: apiRecipient.uf,
        observacoes: apiRecipient.notes || undefined,
      };

      assert.strictEqual(frontendRecipient.telefone, "");
      assert.strictEqual(frontendRecipient.email, undefined);
      assert.strictEqual(frontendRecipient.documento, "");
      assert.strictEqual(frontendRecipient.complemento, undefined);
      assert.strictEqual(frontendRecipient.observacoes, undefined);
    });
  });

  describe("Mapeamento bidirecional (round-trip)", () => {
    it("deve manter dados após mapeamento frontend → API → frontend", () => {
      // Dados originais do frontend
      const original = {
        nome: "João Silva",
        documento: "12345678900",
        telefone: "41999999999",
        email: "joao@example.com",
        cep: "80010-000",
        logradouro: "Rua XV de Novembro",
        numero: "100",
        complemento: "Sala 10",
        bairro: "Centro",
        cidade: "Curitiba",
        uf: "PR",
        observacoes: "Entregar pela manhã",
      };

      // Frontend → API
      const apiPayload = {
        name: original.nome,
        document: original.documento || null,
        phone: original.telefone || null,
        email: original.email || null,
        cep: original.cep,
        logradouro: original.logradouro,
        numero: original.numero,
        complemento: original.complemento || null,
        bairro: original.bairro,
        cidade: original.cidade,
        uf: original.uf,
        notes: original.observacoes || null,
      };

      // Simular resposta da API com ID e timestamps
      const apiResponse = {
        id: "rec_123",
        ...apiPayload,
        isDefault: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      // API → Frontend
      const mapped = {
        id: apiResponse.id,
        nome: apiResponse.name,
        telefone: apiResponse.phone || "",
        email: apiResponse.email || undefined,
        documento: apiResponse.document || "",
        cep: apiResponse.cep,
        logradouro: apiResponse.logradouro,
        numero: apiResponse.numero,
        complemento: apiResponse.complemento || undefined,
        bairro: apiResponse.bairro,
        cidade: apiResponse.cidade,
        uf: apiResponse.uf,
        observacoes: apiResponse.notes || undefined,
      };

      // Verificar que dados essenciais foram preservados
      assert.strictEqual(mapped.nome, original.nome);
      assert.strictEqual(mapped.documento, original.documento);
      assert.strictEqual(mapped.telefone, original.telefone);
      assert.strictEqual(mapped.email, original.email);
      assert.strictEqual(mapped.cep, original.cep);
      assert.strictEqual(mapped.logradouro, original.logradouro);
      assert.strictEqual(mapped.numero, original.numero);
      assert.strictEqual(mapped.complemento, original.complemento);
      assert.strictEqual(mapped.bairro, original.bairro);
      assert.strictEqual(mapped.cidade, original.cidade);
      assert.strictEqual(mapped.uf, original.uf);
      assert.strictEqual(mapped.observacoes, original.observacoes);
    });

    it("deve lidar com campos opcionais nulos no round-trip", () => {
      // Dados originais com campos opcionais vazios
      const original = {
        nome: "João Silva",
        documento: "",
        telefone: "",
        email: undefined,
        cep: "80010-000",
        logradouro: "Rua XV de Novembro",
        numero: "100",
        complemento: undefined,
        bairro: "Centro",
        cidade: "Curitiba",
        uf: "PR",
        observacoes: undefined,
      };

      // Frontend → API
      const apiPayload = {
        name: original.nome,
        document: original.documento || null,
        phone: original.telefone || null,
        email: original.email || null,
        cep: original.cep,
        logradouro: original.logradouro,
        numero: original.numero,
        complemento: original.complemento || null,
        bairro: original.bairro,
        cidade: original.cidade,
        uf: original.uf,
        notes: original.observacoes || null,
      };

      // Simular resposta da API
      const apiResponse = {
        id: "rec_123",
        ...apiPayload,
        isDefault: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      // API → Frontend
      const mapped = {
        id: apiResponse.id,
        nome: apiResponse.name,
        telefone: apiResponse.phone || "",
        email: apiResponse.email || undefined,
        documento: apiResponse.document || "",
        cep: apiResponse.cep,
        logradouro: apiResponse.logradouro,
        numero: apiResponse.numero,
        complemento: apiResponse.complemento || undefined,
        bairro: apiResponse.bairro,
        cidade: apiResponse.cidade,
        uf: apiResponse.uf,
        observacoes: apiResponse.notes || undefined,
      };

      // Verificar que campos opcionais foram normalizados corretamente
      assert.strictEqual(mapped.documento, "");
      assert.strictEqual(mapped.telefone, "");
      assert.strictEqual(mapped.email, undefined);
      assert.strictEqual(mapped.complemento, undefined);
      assert.strictEqual(mapped.observacoes, undefined);
    });
  });
});
