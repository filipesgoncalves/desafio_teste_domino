# desafio_teste_domino

Casos de teste em JavaScript (Jest) que simulam uma partida de **Dominó** para 2 jogadores. Toda a regra de negócio do jogo está dentro do próprio arquivo de teste, [`domino.test.js`](domino.test.js): a partida acontece só pelos testes.

## Especificação do desafio

> Dominó
> - casos de teste para testar uma partida para 02 jogadores;
> - casos de teste em Javascript para testar Javascript.

## Regras implementadas

Dominó "duplo seis", com 28 peças (de 0-0 a 6-6):

- Cada jogador recebe 7 peças. As 14 restantes formam o monte.
- Começa quem tem a maior carroça (6-6, depois 5-5 e assim por diante), e essa peça abre a mesa. Sem carroça nas mãos, começa quem tem a peça de maior soma.
- Na sua vez, o jogador encaixa uma peça numa das pontas da mesa (esquerda ou direita). A peça é virada para casar o número da ponta.
- Quem não tem peça que encaixe compra do monte até conseguir jogar. Com o monte vazio, passa a vez. Quem tem jogada não pode comprar nem passar.
- **Batida**: quem fica sem peças vence e ganha os pontos que sobraram na mão do adversário.
- **Jogo trancado**: se os dois passam seguidos, vence quem tem menos pontos na mão e ganha os pontos do adversário. Pontos iguais dão empate.
- Depois do fim, nenhuma ação é aceita.

## Como executar

Requer Node.js 18 ou superior.

```bash
npm install
npm test
```

## Funcionamento dos casos de teste

O arquivo tem três partes:

1. **Regras do jogo**: a classe `Domino` e funções de apoio (peças, pontos, embaralhamento com semente). A classe aceita uma partida sorteada ou um cenário montado (mãos, monte, mesa e vez), sempre validando que as 28 peças estão presentes uma única vez.
2. **Cenários**: mãos fixas para a abertura e uma mesa trancada (as 7 peças com 6 já jogadas e as duas pontas em 6).
3. **Casos de teste**, agrupados assim:

| Grupo | O que verifica |
|---|---|
| Peças | 28 peças diferentes, 7 carroças, soma total de 168 pontos, 1-6 é a mesma peça que 6-1 |
| Distribuição | 7 peças por jogador e 14 no monte, nenhuma repetida, mesma semente dá a mesma distribuição, cenário inválido recusado |
| Quem começa | Maior carroça abre a mesa, carroça menor quando não há 6-6, maior soma quando não há carroça, primeira jogada obrigatória |
| Jogadas | Encaixe e orientação da peça nas pontas, peça que não encaixa, lado escolhido automaticamente, peça que não é do jogador, alternância da vez, lista de jogadas possíveis |
| Compra e passe | Compra até ter jogada, quem tem jogada não compra nem passa, não passa com monte cheio, passa com monte vazio |
| Fim da partida | Batida com contagem de pontos, jogo trancado com vencedor, empate, contagem de passes zerada por uma jogada, mesa inválida, nada é aceito depois do fim |
| Partida simulada | Partidas sorteadas jogadas até o fim, conferindo a cada ação que as 28 peças continuam no jogo e, no fim, o resultado e a mesa |

Cada teste monta a própria partida, faz as jogadas e confere a mesa, as mãos, o monte, a vez e o resultado (`batida` ou `trancado`, vencedor e pontos).

## Colaborador

- Filipe ([filipesgoncalves](https://github.com/filipesgoncalves))
