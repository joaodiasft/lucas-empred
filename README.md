# Lucas EMPRED

Sistema de gestão de empréstimos. O administrador cadastra o cliente com foto, endereço, localização (se autorizada) e 3 referências de contato.

## Acessos

| Perfil | Login | Senha |
|---|---|---|
| Admin | `admin@lucasempred.com.br` | `Lucas2026` |
| Equipe | `camila@lucasempred.com.br` | `Equipe2026` |
| Cliente | CPF da ficha | PIN = 4 últimos dígitos do telefone |

## Cadastro do cliente

1. Endereço completo primeiro. Localização no mapa só entra se a pessoa permitir.
2. Foto da própria pessoa, gravada na ficha.
3. Três referências: WhatsApp abre conversa; sem WhatsApp, o botão liga.
4. Dados ficam salvos neste aparelho (IndexedDB).

## Comandos

```bash
npm install
npm run dev
npm run build
```
