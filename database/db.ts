import * as SQLite from 'expo-sqlite';

// Instância global protegida para evitar a condição de corrida no Hot Reload
let dbInstance: SQLite.SQLiteDatabase | null = null;

// Função mestra que garante que a base de dados só é aberta uma vez
async function getDb() {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('bytea_textos.db');
  }
  return dbInstance;
}

export async function initDB() {
  try {
    const db = await getDb();

    // Criação das tabelas da V1
    await db.execAsync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS Textos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT,
        conteudo TEXT,
        classe TEXT NOT NULL,
        status TEXT DEFAULT 'Rascunho',
        favorito INTEGER DEFAULT 0,
        arquivado INTEGER DEFAULT 0,
        excluido INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS Tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT UNIQUE
      );

      CREATE TABLE IF NOT EXISTS TextoTags (
        texto_id INTEGER,
        tag_id INTEGER,
        FOREIGN KEY(texto_id) REFERENCES Textos(id) ON DELETE CASCADE,
        FOREIGN KEY(tag_id) REFERENCES Tags(id) ON DELETE CASCADE
      );
    `);

    try {
      await db.execAsync(`ALTER TABLE Textos ADD COLUMN excluido INTEGER DEFAULT 0;`);
    } catch (e) {
      // A coluna já existe, segue em frente!
    }

    return true;
  } catch (error) {
    console.error("Erro crítico na inicialização do DB:", error);
    return false;
  }
}

export async function criarTexto(titulo: string, conteudo: string, classe: string) {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO Textos (titulo, conteudo, classe) VALUES (?, ?, ?)',
    [titulo, conteudo, classe]
  );
  return result.lastInsertRowId;
}

export async function atualizarTexto(
  id: number, titulo: string, conteudo: string, 
  classe: string, status: string, favorito: number, arquivado: number
) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE Textos SET titulo = ?, conteudo = ?, classe = ?, status = ?, favorito = ?, arquivado = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
    [titulo, conteudo, classe, status, favorito, arquivado, id]
  );
}

export async function deletarTexto(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM Textos WHERE id = ?', [id]);
}

export async function getTextoPorId(id: number) {
  try {
    const db = await getDb();
    return await db.getFirstAsync('SELECT * FROM Textos WHERE id = ?', [id]);
  } catch (e) {
    return null;
  }
}

export async function buscarTodosTextos() {
  try {
    const db = await getDb();
    return await db.getAllAsync(`
      SELECT Textos.*, GROUP_CONCAT(Tags.nome) as tags_array
      FROM Textos 
      LEFT JOIN TextoTags ON Textos.id = TextoTags.texto_id
      LEFT JOIN Tags ON TextoTags.tag_id = Tags.id
      GROUP BY Textos.id
      ORDER BY Textos.atualizado_em DESC
    `);
  } catch (error) {
    console.warn("Retenção de segurança ativada. A aguardar recarregamento da base de dados...");
    return []; // 🛡️ ESCUDO: Retorna vazio em vez do erro "NullPointerException"
  }
}

export async function atualizarTags(textoId: number, tagsString: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM TextoTags WHERE texto_id = ?', [textoId]);
  
  const tags = tagsString.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
  
  for (const tag of tags) {
    await db.runAsync('INSERT OR IGNORE INTO Tags (nome) VALUES (?)', [tag]);
    const tagRow: any = await db.getFirstAsync('SELECT id FROM Tags WHERE nome = ?', [tag]);
    if (tagRow) {
      await db.runAsync('INSERT INTO TextoTags (texto_id, tag_id) VALUES (?, ?)', [textoId, tagRow.id]);
    }
  }
}

export async function alternarLixeira(id: number, excluido: number) {
  const db = await getDb();
  await db.runAsync('UPDATE Textos SET excluido = ? WHERE id = ?', [excluido, id]);
}

export async function getTagsDoTexto(textoId: number) {
  try {
    const db = await getDb();
    const rows: any[] = await db.getAllAsync(`
      SELECT Tags.nome FROM Tags 
      JOIN TextoTags ON Tags.id = TextoTags.tag_id 
      WHERE TextoTags.texto_id = ?
    `, [textoId]);
    return rows.map(r => r.nome).join(', ');
  } catch (e) {
    return '';
  }
}

export async function exportarDadosJSON() {
  const db = await getDb();
  const textos = await db.getAllAsync('SELECT * FROM Textos');
  const tags = await db.getAllAsync('SELECT * FROM Tags');
  const textoTags = await db.getAllAsync('SELECT * FROM TextoTags');
  return JSON.stringify({ textos, tags, textoTags });
}

export async function importarDadosJSON(jsonString: string) {
  const db = await getDb();
  const data = JSON.parse(jsonString);
  
  if (!data.textos) throw new Error('Arquivo de backup inválido.');

  await db.execAsync(`
    DELETE FROM TextoTags;
    DELETE FROM Tags;
    DELETE FROM Textos;
  `);

  for (const t of data.textos) {
    await db.runAsync(
      'INSERT INTO Textos (id, titulo, conteudo, classe, status, favorito, arquivado, excluido, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [t.id, t.titulo, t.conteudo, t.classe, t.status, t.favorito, t.arquivado, t.excluido || 0, t.criado_em, t.atualizado_em]
    );
  }

  if (data.tags) {
    for (const tag of data.tags) {
      await db.runAsync('INSERT OR IGNORE INTO Tags (id, nome) VALUES (?, ?)', [tag.id, tag.nome]);
    }
  }

  if (data.textoTags) {
    for (const tt of data.textoTags) {
      await db.runAsync('INSERT INTO TextoTags (texto_id, tag_id) VALUES (?, ?)', [tt.texto_id, tt.tag_id]);
    }
  }
}