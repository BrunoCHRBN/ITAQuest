import type { Question } from '../types';

const now = '2026-10-18T12:00:00.000Z';

// Banco zerado para início da inserção de questões reais.
export const seedQuestions: Question[] = [];

// Exemplos sintéticos preservados para referência ou demonstração. Não são questões oficiais do ITA.
export const demoSyntheticQuestions: Question[] = [
  {
    id: 'demo-mat-001', subject: 'Matemática', topic: 'Equações algébricas', difficulty: 'Básica',
    statement: 'As raízes reais da equação x² − 5x + 6 = 0 são r₁ e r₂. Qual é o valor de r₁ + r₂?',
    alternatives: { A: '2', B: '3', C: '5', D: '6', E: '−5' }, answerKey: 'C',
    explanation: 'Pelas relações de Viète, a soma das raízes de ax² + bx + c = 0 é −b/a. Assim, r₁ + r₂ = 5.',
    source: { label: 'Exemplo demonstrativo' }, tags: ['álgebra', 'equações'], createdAt: now,
  },
  {
    id: 'demo-fis-001', subject: 'Física', topic: 'Cinemática', difficulty: 'Básica',
    statement: 'Um móvel desloca-se em linha reta com velocidade constante de 20 m/s durante 15 s. Qual é o módulo do deslocamento nesse intervalo?',
    alternatives: { A: '35 m', B: '150 m', C: '200 m', D: '300 m', E: '450 m' }, answerKey: 'D',
    explanation: 'No movimento uniforme, Δs = v · Δt. Portanto, Δs = 20 · 15 = 300 m.',
    source: { label: 'Exemplo demonstrativo' }, tags: ['movimento uniforme', 'velocidade'], createdAt: now,
  },
  {
    id: 'demo-qui-001', subject: 'Química', topic: 'Ácidos e bases', difficulty: 'Básica',
    statement: 'A 25 °C, uma solução aquosa ideal apresenta concentração de íons H₃O⁺ igual a 1,0 × 10⁻⁷ mol/L. Qual é o pH dessa solução?',
    alternatives: { A: '1', B: '7', C: '−7', D: '10', E: '14' }, answerKey: 'B',
    explanation: 'Por definição, pH = −log₁₀[H₃O⁺]. Logo, pH = −log₁₀(10⁻⁷) = 7.',
    source: { label: 'Exemplo demonstrativo' }, tags: ['pH', 'soluções aquosas'], createdAt: now,
  },
  {
    id: 'demo-mat-002', subject: 'Matemática', topic: 'Geometria plana', difficulty: 'Intermediária',
    statement: 'Um triângulo retângulo tem catetos de comprimentos 6 cm e 8 cm. Qual é o comprimento da hipotenusa?',
    alternatives: { A: '7 cm', B: '9 cm', C: '10 cm', D: '12 cm', E: '14 cm' }, answerKey: 'C',
    explanation: 'Pelo teorema de Pitágoras, h² = 6² + 8² = 36 + 64 = 100. Como h é positivo, h = 10 cm.',
    source: { label: 'Exemplo demonstrativo' }, tags: ['Pitágoras', 'triângulos'], createdAt: now,
  },
  {
    id: 'demo-fis-002', subject: 'Física', topic: 'Energia mecânica', difficulty: 'Intermediária',
    statement: 'Considere g = 10 m/s². Um objeto de massa 2 kg está a 5 m de altura em relação a um nível de referência. Qual é sua energia potencial gravitacional em relação a esse nível?',
    alternatives: { A: '10 J', B: '25 J', C: '50 J', D: '100 J', E: '200 J' }, answerKey: 'D',
    explanation: 'A energia potencial gravitacional é Eₚ = mgh = 2 · 10 · 5 = 100 J.',
    source: { label: 'Exemplo demonstrativo' }, tags: ['energia potencial', 'gravitação'], createdAt: now,
  },
  {
    id: 'demo-qui-002', subject: 'Química', topic: 'Estrutura atômica', difficulty: 'Básica',
    statement: 'O número atômico de um elemento químico corresponde ao número de:',
    alternatives: { A: 'nêutrons no núcleo', B: 'prótons no núcleo', C: 'níveis eletrônicos', D: 'prótons e nêutrons somados', E: 'elétrons de valência, sempre' }, answerKey: 'B',
    explanation: 'O número atômico Z é definido pelo número de prótons no núcleo. Em um átomo neutro, esse número também é igual ao de elétrons.',
    source: { label: 'Exemplo demonstrativo' }, tags: ['átomo', 'número atômico'], createdAt: now,
  },
  {
    id: 'demo-mat-003', subject: 'Matemática', topic: 'Funções', difficulty: 'Intermediária',
    statement: 'Se f(x) = 2x − 3, qual é o valor de f(4)?',
    alternatives: { A: '1', B: '3', C: '5', D: '8', E: '11' }, answerKey: 'C',
    explanation: 'Substituindo x = 4: f(4) = 2 · 4 − 3 = 8 − 3 = 5.',
    source: { label: 'Exemplo demonstrativo' }, tags: ['função afim', 'substituição'], createdAt: now,
  },
  {
    id: 'demo-por-001', subject: 'Português', topic: 'Interpretação de texto', difficulty: 'Intermediária',
    statement: 'Em uma argumentação, a função principal de um conectivo conclusivo, como “portanto”, é indicar:',
    alternatives: { A: 'oposição entre ideias', B: 'uma condição hipotética', C: 'uma explicação de causa', D: 'uma conclusão decorrente das ideias anteriores', E: 'uma enumeração sem relação lógica' }, answerKey: 'D',
    explanation: 'Conectivos conclusivos introduzem uma inferência ou conclusão resultante do que foi apresentado anteriormente.',
    source: { label: 'Exemplo demonstrativo' }, tags: ['coesão', 'conectivos'], createdAt: now,
  },
];
