# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6]:
    - generic [ref=e8]:
      - heading "Bem-vindo de volta" [level=3] [ref=e9]
      - generic [ref=e10]: Acesse o painel e gerencie seus envios com mais agilidade.
    - generic [ref=e11]:
      - generic [ref=e13]:
        - generic "E-mail" [ref=e15]
        - textbox "seuemail@empresa.com" [ref=e19]
      - generic [ref=e21]:
        - generic "Senha" [ref=e23]
        - generic [ref=e27]:
          - textbox "Digite sua senha" [ref=e28]
          - img "eye-invisible" [ref=e30] [cursor=pointer]:
            - img [ref=e31]
      - generic [ref=e34]:
        - generic [ref=e35] [cursor=pointer]:
          - checkbox "Lembrar meu e-mail" [ref=e37]
          - generic [ref=e39]: Lembrar meu e-mail
        - link "Esqueci minha senha" [ref=e40] [cursor=pointer]:
          - /url: /auth/forgot-password
      - generic [ref=e41]:
        - button "Entrar" [ref=e42] [cursor=pointer]:
          - generic [ref=e43]: Entrar
        - generic [ref=e44]: ou
        - button "google Continuar com Google" [ref=e45] [cursor=pointer]:
          - img "google" [ref=e47]:
            - img [ref=e48]
          - generic [ref=e50]: Continuar com Google
    - generic [ref=e51]:
      - text: Ainda não tem conta?
      - link "Crie agora mesmo" [ref=e52] [cursor=pointer]:
        - /url: /auth/cadastro
  - button "Open Next.js Dev Tools" [ref=e58] [cursor=pointer]:
    - img [ref=e59]
  - alert [ref=e62]
```