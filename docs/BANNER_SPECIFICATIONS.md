# Especificação de Banner para Loja Pública

## 1. Área Visível

- **Mobile**: altura visível ~ **180 px**
- **Tablet**: altura visível ~ **220 px**
- **Desktop**: altura visível ~ **280 px**

### Largura

- Container central com `max-w-5xl` (largura máxima prática no desktop: **1024 px**)
- No mobile, ocupa praticamente a largura da tela, menos as margens laterais.

---

## 2. Dimensão Ideal do Arquivo de Banner (Versão estática)

- **Arte principal**: **1600 × 560 px**
- Formato recomendado: **WebP** (ou PNG/JPG se necessário)
- Peso ideal: até **3 MB** (máximo aceitável **5 MB**)

### Área Segura dentro da Arte

| Tipo | Eixo X | Eixo Y |
|------|--------|--------|
| Área segura geral | **80** → **1520** | **60** → **500** |
| Área segura premium (logo, frase principal, produto) | **100** → **980** | **90** → **420** |

---

## 3. Versão Mobile Opcional (arte separada)

- **Arte mobile**: **1080 × 720 px**
- Formato: WebP/PNG/JPG
- Área segura principal:
  - **X**: 60 → 1020
  - **Y**: 70 → 650

Esta versão pode ser usada para melhorar a experiência em dispositivos pequenos, mas não é obrigatória para o MVP.

---

## 4. Vídeo Pequeno no Banner

### Recomendações Gerais

- Uso preferencial em **desktop** e **tablet**.
- No **mobile**: opcional – pode usar um frame/poster estático ou uma versão de vídeo menores.

### Especificação Técnica do Vídeo

- **Formato:** MP4 (H.264) – opcional WebM
- **Duração:** 6‑10 s (loopável)
- **Comportamento:** `muted`, `autoplay`, `loop`, `playsInline`
- **Resolução de origem:** 1280 × 720 **ou** 960 × 540
- **Peso recomendado:** até **3 MB** (máx. 5 MB)
- **Poster:** imagem estática (mesma identidade visual do banner)

---

## 5. Área Reservada para Vídeo (versão estática 1600 × 560)

- **Posição:** canto superior direito
- **Coordenadas e dimensões:**
  - **X** = **1080**
  - **Y** = **92**
  - **Largura** = **400 px**
  - **Altura** = **225 px**
- **Proporção:** 16:9 (bloco 400 × 225)

Esta área deixa amplo espaço à esquerda para logo, nome da loja, frase e destaque promocional.

---

## 6. Área Reservada para Vídeo (versão mobile 1080 × 720) – Opcional

- **X** = **620**
- **Y** = **90**
- **Largura** = **360 px**
- **Altura** = **202 px**
- **Proporção:** 16:9

---

## 7. Resumo das Ações

1. Produzir a arte estática **1600 × 560 px** (WebP) com a janela de vídeo indicada.
2. (Opcional) Produzir a arte mobile **1080 × 720 px** seguindo as áreas seguras.
3. Criar o vídeo pequeno (MP4) com as especificações acima.
4. Gerar o poster do vídeo (imagem estática) para uso como fallback.

---

*Este documento fornece todas as informações necessárias para a criação e integração do banner responsivo no frontend da aplicação OptmaMenu.*
