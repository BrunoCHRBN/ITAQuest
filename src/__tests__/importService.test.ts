import { describe, expect, it } from 'vitest';
import { csvToRows, resolveImportedFile } from '../services/importService';

describe('importService', () => {
  it('parses structured JSON array of questions', () => {
    const json = JSON.stringify([
      {
        subject: 'Matemática',
        topic: 'Geometria',
        difficulty: 'Avançada',
        statement: 'Calcule a área do triângulo.',
        alternatives: { A: '10', B: '20', C: '30', D: '40', E: '50' },
        answerKey: 'B',
        source: { label: 'ITA', year: 2023, phase: '1ª fase', questionNumber: 5 },
      },
    ]);

    const { questions, warnings } = resolveImportedFile(json, 'teste.json');
    expect(questions).toHaveLength(1);
    expect(questions[0].subject).toBe('Matemática');
    expect(questions[0].topic).toBe('Geometria');
    expect(questions[0].difficulty).toBe('Avançada');
    expect(questions[0].answerKey).toBe('B');
    expect(questions[0].source.label).toBe('ITA');
    expect(questions[0].source.year).toBe(2023);
    expect(questions[0].source.fileName).toBe('teste.json');
    expect(warnings).toHaveLength(0);
  });

  it('parses JSON with questions property and Portuguese field names', () => {
    const json = JSON.stringify({
      questoes: [
        {
          materia: 'Física',
          assunto: 'Termodinâmica',
          dificuldade: 'fácil',
          enunciado: 'Qual a primeira lei da termodinâmica?',
          alternativas: { A: 'ΔU = Q - W', B: 'PV = nRT' },
          gabarito: 'A',
          resolucao: 'Pela conservação de energia, ΔU = Q - W.',
          origem: { instituicao: 'ITA', ano: 2022 },
        },
      ],
    });

    const { questions, warnings } = resolveImportedFile(json, 'provas.json');
    expect(questions).toHaveLength(1);
    expect(questions[0].subject).toBe('Física');
    expect(questions[0].difficulty).toBe('Básica');
    expect(questions[0].statement).toBe('Qual a primeira lei da termodinâmica?');
    expect(questions[0].answerKey).toBe('A');
    expect(questions[0].explanation).toBe('Pela conservação de energia, ΔU = Q - W.');
    expect(warnings).toHaveLength(0);
  });

  it('parses CSV with BOM, quotes, commas and alternatives', () => {
    const csv = '\uFEFFenunciado,materia,assunto,dificuldade,gabarito,A,B,C,D,E,origem,ano\n' +
      '"Se f(x) = 2x, quanto vale f(3)?",Matemática,Funções,Básica,C,"2","4","6","8","10",ITA,2021';

    const { questions, warnings } = resolveImportedFile(csv, 'ita-2021.csv');
    expect(questions).toHaveLength(1);
    expect(questions[0].statement).toBe('Se f(x) = 2x, quanto vale f(3)?');
    expect(questions[0].alternatives.C).toBe('6');
    expect(questions[0].answerKey).toBe('C');
    expect(questions[0].source.year).toBe(2021);
    expect(warnings).toHaveLength(0);
  });

  it('handles CSV with escaped quotes inside cells', () => {
    const csv = 'statement,subject,topic,difficulty,answerKey,A,B\n' +
      '"Ele disse: ""Olá mundo"", certo?",Português,Sintaxe,Básica,A,Sim,Não';

    const rows = csvToRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].statement).toBe('Ele disse: "Olá mundo", certo?');
  });

  it('throws error for invalid JSON syntax', () => {
    expect(() => resolveImportedFile('{ invalid json', 'teste.json')).toThrow(
      'JSON inválido. Verifique a sintaxe do arquivo enviado.'
    );
  });

  it('throws error for empty CSV or missing headers', () => {
    expect(() => resolveImportedFile('', 'empty.csv')).toThrow(
      'O arquivo CSV está vazio ou não possui cabeçalhos válidos.'
    );
  });

  it('generates warnings for structural inconsistencies (e.g. answer key not in alternatives)', () => {
    const json = JSON.stringify([
      {
        statement: 'Questão com alternativa única e gabarito inexistente',
        subject: 'Química',
        alternatives: { A: 'Apenas uma' },
        answerKey: 'C',
      },
    ]);

    const { questions, warnings } = resolveImportedFile(json, 'teste.json');
    expect(questions).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('possui apenas uma alternativa'))).toBe(true);
    expect(warnings.some((w) => w.includes('gabarito "C" não está entre as alternativas'))).toBe(true);
  });

  it('ignores invalid items without statement and registers warnings', () => {
    const json = JSON.stringify([
      { topic: 'Sem enunciado' },
      { statement: 'Enunciado válido', subject: 'Matemática' },
    ]);

    const { questions, warnings } = resolveImportedFile(json, 'teste.json');
    expect(questions).toHaveLength(1);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('enunciado ausente ou vazio');
  });
});
