# Empréstimo com parcela mensal e pagamento semanal

Data: 2026-08-28  
Projeto: Lucas EMPRED

## Objetivo

Cada empréstimo novo tem dois pagamentos independentes:

1. Parcela mensal do valor emprestado, dividido igualmente pelos meses.
2. Pagamento semanal fixo, em todas as ocorrências reais do dia da semana escolhido.

Se os dois caírem no mesmo dia, os dois continuam devidos. O sistema mostra as duas linhas e o total do dia.

## Entradas

- Cliente
- Valor emprestado
- Data de início (informada)
- Prazo em meses
- Dia do vencimento mensal (1 a 31)
- Valor semanal
- Dia da semana do semanal
- Multa por atraso (já existente)

## Regras de calendário

- Primeira parcela mensal: dia escolhido do mês seguinte ao início, mesmo se o início já for esse dia.
- Encerramento contratual: data de início + prazo em meses.
- Semanais: primeira ocorrência depois da data de início. Se o início cair no dia escolhido, essa data não entra.
- Se a data de encerramento cair no dia da semana escolhido, esse semanal entra.
- Semanais param no encerramento contratual (início + N meses), inclusive.
- Mês sem o dia escolhido (ex.: 31 em abril): usa o último dia daquele mês.
- Sempre existem N parcelas mensais. Se o dia mensal for depois do dia de início, a última mensal pode cair depois do encerramento contratual. Nesse caso a mensal continua existindo.
- Data de encerramento exibida: última data de qualquer pagamento (mensal ou semanal).
- Centavos: a diferença da divisão vai na última parcela mensal.

## Dados

Cada pagamento é uma parcela com `kind: monthly | weekly`. Pagar uma não quita a outra.

Campos do empréstimo: `startDate`, `endDate`, `termMonths`, `monthlyDueDay`, `weeklyAmount`, `weeklyWeekday`.

Empréstimos antigos do modelo semanal único permanecem como estão.

## Telas

- Novo empréstimo: formulário + resumo ao vivo + tabela cronológica.
- Detalhe: totais, pago, pendente, atrasados, próximo vencimento, tabela com ações por linha.
- Calendário, cobrança e relatórios usam a mesma lista.

## Fluxo

As datas são geradas na criação e gravadas. Não são recalculadas depois. Multa continua por parcela.
