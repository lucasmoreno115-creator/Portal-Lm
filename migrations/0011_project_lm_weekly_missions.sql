CREATE TABLE IF NOT EXISTS project_lm_weekly_missions (
  week_number INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  main_mission TEXT NOT NULL,
  success_criteria TEXT NOT NULL
);

INSERT OR REPLACE INTO project_lm_weekly_missions (week_number, title, description, main_mission, success_criteria) VALUES
(1, 'Pare de Recomeçar', 'Seu objetivo nesta semana não é emagrecer rápido. É criar movimento.', 'Cumprir 3 ações mínimas.', '3 ações registradas.'),
(2, 'Proteja os Dias Difíceis', 'Aprenda a continuar mesmo quando a rotina apertar.', 'Utilizar o Modo Dia Difícil pelo menos uma vez.', '1 utilização registrada.'),
(3, 'Construa Repetição', 'O foco agora é repetir comportamentos simples.', 'Completar 5 dias ativos.', '5 registros de consistência.'),
(4, 'Pensar Como Alguém Consistente', 'Consolidar tudo que foi construído.', 'Concluir a jornada inicial.', 'Finalizar as 4 semanas.');
