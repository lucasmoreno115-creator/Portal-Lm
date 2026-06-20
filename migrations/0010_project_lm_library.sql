CREATE TABLE IF NOT EXISTS project_lm_library_content (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  summary TEXT,
  action_text TEXT,
  unlock_rule TEXT NOT NULL DEFAULT 'always',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_lm_library_content_sort
  ON project_lm_library_content(sort_order);

CREATE TABLE IF NOT EXISTS project_lm_library_progress (
  id TEXT PRIMARY KEY,
  student_email TEXT NOT NULL,
  content_slug TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_lm_library_progress_unique
  ON project_lm_library_progress(student_email, content_slug);

CREATE INDEX IF NOT EXISTS idx_project_lm_library_progress_student
  ON project_lm_library_progress(student_email);

INSERT OR IGNORE INTO project_lm_library_content (id, slug, title, description, video_url, summary, action_text, unlock_rule, sort_order, created_at) VALUES
('project-lm-library-01', 'como-comecar-e-continuar', 'Como começar e continuar', 'O primeiro passo para sair do ciclo de recomeços e proteger o básico.', '', 'Resumo inicial preparado para o conteúdo “Como começar e continuar”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'always', 1, CURRENT_TIMESTAMP),
('project-lm-library-02', 'a-regra-do-minimo', 'A Regra do Mínimo', 'Como transformar dias difíceis em dias válidos, sem depender de perfeição.', '', 'Resumo inicial preparado para o conteúdo “A Regra do Mínimo”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'always', 2, CURRENT_TIMESTAMP),
('project-lm-library-03', 'o-erro-de-recomecar-toda-segunda', 'O Erro de Recomeçar Toda Segunda', 'Por que esperar a próxima segunda enfraquece sua consistência.', '', 'Resumo inicial preparado para o conteúdo “O Erro de Recomeçar Toda Segunda”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'first_victory', 3, CURRENT_TIMESTAMP),
('project-lm-library-04', 'consistencia-vence-intensidade', 'Consistência Vence Intensidade', 'Aprenda a construir resultado repetindo o possível.', '', 'Resumo inicial preparado para o conteúdo “Consistência Vence Intensidade”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'hard_day_mode', 4, CURRENT_TIMESTAMP),
('project-lm-library-05', 'como-recomecar-sem-culpa', 'Como Recomeçar Sem Culpa', 'Um caminho simples para voltar sem compensação e sem extremos.', '', 'Resumo inicial preparado para o conteúdo “Como Recomeçar Sem Culpa”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_3', 5, CURRENT_TIMESTAMP),
('project-lm-library-06', 'pare-de-procurar-a-dieta-perfeita', 'Pare de Procurar a Dieta Perfeita', 'Organização e aderência antes de trocar de método.', '', 'Resumo inicial preparado para o conteúdo “Pare de Procurar a Dieta Perfeita”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_7', 6, CURRENT_TIMESTAMP),
('project-lm-library-07', 'o-processo-acima-do-resultado', 'O Processo Acima do Resultado', 'Como medir evolução antes da balança confirmar.', '', 'Resumo inicial preparado para o conteúdo “O Processo Acima do Resultado”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_14', 7, CURRENT_TIMESTAMP),
('project-lm-library-08', 'como-nao-abandonar-depois-de-uma-semana-ruim', 'Como Não Abandonar Depois de uma Semana Ruim', 'Estratégia para manter identidade e direção após uma semana instável.', '', 'Resumo inicial preparado para o conteúdo “Como Não Abandonar Depois de uma Semana Ruim”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_21', 8, CURRENT_TIMESTAMP),
('project-lm-library-09', 'o-que-fazer-quando-a-motivacao-sumir', 'O Que Fazer Quando a Motivação Sumir', 'Como continuar quando a vontade não aparece.', '', 'Resumo inicial preparado para o conteúdo “O Que Fazer Quando a Motivação Sumir”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_30', 9, CURRENT_TIMESTAMP),
('project-lm-library-10', 'a-pessoa-que-voce-esta-se-tornando', 'A Pessoa Que Você Está Se Tornando', 'Consolide a visão de longo prazo construída pelas pequenas ações.', '', 'Resumo inicial preparado para o conteúdo “A Pessoa Que Você Está Se Tornando”. O vídeo será cadastrado em uma etapa futura.', 'Escolha uma ação mínima relacionada ao tema e registre como você vai aplicá-la hoje.', 'streak_45', 10, CURRENT_TIMESTAMP);
