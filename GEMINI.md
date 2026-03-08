# Multiverse Survivors - Projeto de Jogo Multiplayer

Este projeto é um jogo de sobrevivência estilo "Vampire Survivors", desenvolvido com HTML5 Canvas, CSS3 e JavaScript (ES Modules). O jogo possui suporte para multiplayer online P2P utilizando a biblioteca **Trystero**.

## Visão Geral do Projeto

O jogo coloca os jogadores em uma arena contra hordas de zumbis. Os jogadores podem escolher entre dois heróis:
- **Scott Summers:** Utiliza um laser óptico contínuo que causa dano progressivo e para no primeiro inimigo atingido.
- **Wanda Maximoff:** Dispara esferas de magia do caos com alto dano de impacto.

### Tecnologias Principais
- **HTML5 Canvas:** Renderização gráfica 2D.
- **Trystero (esm.sh):** Biblioteca para multiplayer P2P via WebRTC (usando protocolo Torrent para sinalização).
- **JavaScript (Modern ES Modules):** Lógica do jogo e rede.
- **CSS Vanilla:** Estilização da UI e menus.

## Arquitetura e Estrutura

- `index.html`: Ponto de entrada, contém a estrutura do Canvas e os overlays de interface (menus, seleção de herói, HUD).
- `game.js`: Arquivo principal contendo a lógica do jogo, sistema de partículas, classes de personagens/inimigos e a implementação da rede.
- `style.css`: Estilos visuais, animações de menu e layout responsivo.
- `images/`: Diretório de assets contendo sprites para personagens, inimigos e efeitos.

## Sistema Multiplayer (Host/Client)

O jogo utiliza um modelo de autoridade baseada em **Host**:
1.  **Host (Criador da Sala):** 
    - É responsável por spawnar e mover os inimigos.
    - Calcula colisões entre inimigos (separação de horda).
    - Valida o dano recebido pelos inimigos e gerencia a pontuação global.
    - Sincroniza a lista de inimigos para todos os clientes.
2.  **Client (Entra na Sala):**
    - Envia sua posição, animação e estado de disparo para os outros.
    - Reporta acertos (hits) ao Host para validação de dano.
    - Recebe atualizações de estado do mundo do Host.

## Convenções de Desenvolvimento

- **Movimentação:** 4 direções (W, A, S, D ou Setas).
- **Ataque:** Ocorre na direção do cursor do mouse.
- **Equilíbrio de Combate:**
    - Zumbis possuem **2.0 HP**.
    - Projéteis da Wanda causam **1.0 de dano**.
    - Laser do Scott causa **0.7 de dano** por toque (necessita de 3 toques para matar).
- **Sincronização:** Todo estado crítico (nickname, posição, disparo, vida do inimigo) deve ser transmitido via ações do Trystero (`update`, `shoot`, `enemies`, `enemyHit`, `score`, `pause`).

## Como Executar

Por ser um projeto puramente front-end com módulos ES, ele requer um servidor local para funcionar devido às políticas de segurança do navegador (CORS/MIME types):

1.  Navegue até a pasta do projeto.
2.  Inicie um servidor estático (ex: `python3 -m http.server`, `npx serve`, ou use a extensão "Live Server" do VS Code).
3.  Abra o endereço (geralmente `http://localhost:8000`) em dois navegadores ou abas diferentes para testar o multiplayer.

---
*Instruções geradas para o contexto do Gemini CLI.*
