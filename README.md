# Garyu Dojo

Jogo de luta de karatê que roda no navegador: no computador (teclado) e no celular (joystick e botões na tela).
É só HTML + JavaScript, sem instalar nada e sem "compilar".

Lutadores: **Jessy**, **Gui** e **Kauã**.

## Jogar no computador (local)

Na pasta do projeto:

```
python -m http.server 8765
```

Depois abra <http://localhost:8765>. Abrir o `index.html` com dois cliques não funciona, porque o navegador bloqueia o carregamento das imagens.

Extras na URL:
- `?demo` – CPU contra CPU
- `?debug` – mostra as áreas de golpe (vermelho) e de corpo (verde)

## Publicar no Vercel

1. Entre em <https://vercel.com> com a conta do GitHub.
2. **Add New → Project** e escolha este repositório.
3. Framework: **Other**. Deixe o Root Directory como está (a raiz) e não coloque comando de build.
4. Clique em **Deploy**.

A cada `git push`, o Vercel atualiza o site sozinho.

## Controles

Ao abrir, o jogo pergunta se você vai jogar no **celular** ou no **computador** (dá para trocar no menu).
No menu, a opção **COMO JOGAR** mostra os golpes de cada lutador.

**Teclado:**
- Jogador 1: `A`/`D` andar, `W` pular, `S` agachar, `J` soco, `K` chute, `L` forte, `I` poder
- Jogador 2: setas, `N` soco, `M` chute, `,` forte, `.` poder
- `ESC` pausa, `M` liga/desliga o som

**Celular:** joystick à esquerda e botões SOCO, CHUTE, FORTE e PODER à direita.

| Comando | O que faz |
|---|---|
| PODER | energia (bola/onda) |
| ↑ + PODER | golpe especial que sobe |
| ↓ + PODER | redemoinho de chutes |
| FORTE + PODER | SUPER (barra cheia) |
| segurar para trás | defender |
| tocar 2x para frente/trás | dash |

## Onde mudar as coisas

| O quê | Arquivo |
|---|---|
| Nome do jogo, vida, tempo, velocidade, dificuldade da CPU | `js/config.js` |
| Dano, alcance e reação de cada golpe; lista de golpes | `js/moves.js` |
| Lutadores que aparecem na escolha | `ROSTER` em `js/main.js` |
| Como a CPU luta | `js/ai.js` |
| Cenário | `js/stage.js` |
| Sons e vozes | `js/audio.js` |

Os desenhos dos lutadores (`assets/<nome>/`) são gerados a partir dos PNGs originais pelo script `tools/export_web.py` do projeto original.
