# Gera os ícones e o ecrã de arranque provisórios da app Android a partir do
# icon-512.png (lua em creme e ponto laranja sobre roxo).
# Uso: python scripts/gerar-icones-android.py   (precisa do Pillow)
#
# Os ícones adaptativos (Android 8+) e o ecrã de arranque são vetoriais: a
# geometria abaixo foi medida no icon-512.png (três círculos; o desenho
# coincide com o PNG em todos os píxeis exceto 39 de ~22 mil nas orlas).
# Os PNG de ic_launcher e ic_launcher_round só servem o Android 7 (API 24-25)
# e saem do próprio icon-512.png reduzido.
#
# Provisório: os ícones finais das lojas são o E1/E2 do tracker.
import math
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
RES = RAIZ / 'android' / 'app' / 'src' / 'main' / 'res'

# Geometria do icon-512.png, em píxeis da imagem de 512.
LUA_FORA = (256, 246, 144)    # círculo exterior da lua
LUA_DENTRO = (318, 215, 144)  # círculo que a recorta
PONTO = (343, 343, 26)
CREME, LARANJA = '#FAF6F0', '#E09E3E'

# Ícone adaptativo: tela de 108 dp, da qual os launchers mostram pelo menos os
# 72 dp do centro. Os 512 px do PNG ocupam esses 72 dp, por isso a lua fica
# com as mesmas proporções do ícone da PWA.
ESCALA = 72 / 512
MARGEM = (108 - 72) / 2

DENSIDADES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def n(v):
    return f'{v:.3f}'.rstrip('0').rstrip('.')


def para_dp(x, y):
    return MARGEM + x * ESCALA, MARGEM + y * ESCALA


def caminho_lua():
    (ox, oy, r), (ix, iy, _) = LUA_FORA, LUA_DENTRO
    # Os dois círculos têm o mesmo raio: cruzam-se na mediatriz dos centros.
    mx, my = (ox + ix) / 2, (oy + iy) / 2
    d = math.hypot(ix - ox, iy - oy)
    h = math.sqrt(r * r - (d / 2) ** 2)
    px, py = -(iy - oy) / d, (ix - ox) / d
    p1 = (mx + h * px, my + h * py)
    p2 = (mx - h * px, my - h * py)
    # Arco grande do círculo de fora, do lado oposto ao recorte; volta pelo
    # arco pequeno do círculo de dentro. O sentido sai do produto vetorial.
    cruz = (p1[0] - ox) * (p2[1] - oy) - (p1[1] - oy) * (p2[0] - ox)
    lado_fora = 0 if cruz > 0 else 1
    rd = r * ESCALA
    a, b = para_dp(*p1), para_dp(*p2)
    return (f'M{n(a[0])},{n(a[1])} '
            f'A{n(rd)},{n(rd)} 0 1,{lado_fora} {n(b[0])},{n(b[1])} '
            f'A{n(rd)},{n(rd)} 0 0,{1 - lado_fora} {n(a[0])},{n(a[1])} Z')


def caminho_circulo(cx, cy, r):
    return (f'M{n(cx - r)},{n(cy)} A{n(r)},{n(r)} 0 1,1 {n(cx + r)},{n(cy)} '
            f'A{n(r)},{n(r)} 0 1,1 {n(cx - r)},{n(cy)} Z')


def caminhos_desenho():
    px, py = para_dp(*PONTO[:2])
    return (f'    <path android:fillColor="{CREME}" android:pathData="{caminho_lua()}"/>\n'
            f'    <path android:fillColor="{LARANJA}" '
            f'android:pathData="{caminho_circulo(px, py, PONTO[2] * ESCALA)}"/>\n')


def vetor(tamanho, corpo):
    return ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<!-- Gerado por scripts/gerar-icones-android.py: não editar à mão. -->\n'
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            f'    android:width="{tamanho}dp" android:height="{tamanho}dp"\n'
            f'    android:viewportWidth="{tamanho}" android:viewportHeight="{tamanho}">\n'
            f'{corpo}</vector>\n')


def escrever(caminho, texto):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(texto, encoding='utf-8', newline='\n')


def vetores():
    # Primeiro plano do ícone adaptativo (fundo: @color/ic_launcher_background).
    escrever(RES / 'drawable' / 'ic_launcher_foreground.xml', vetor(108, caminhos_desenho()))
    # Ícone do ecrã de arranque antigo (android:background do tema): o centro de
    # 72 dp do ícone adaptativo, já recortado em círculo roxo.
    corpo = (f'    <path android:fillColor="@color/ic_launcher_background" '
             f'android:pathData="{caminho_circulo(36, 36, 36)}"/>\n'
             f'    <group android:translateX="-{n(MARGEM)}" android:translateY="-{n(MARGEM)}">\n'
             + ''.join('    ' + linha + '\n' for linha in caminhos_desenho().splitlines())
             + '    </group>\n')
    escrever(RES / 'drawable' / 'splash_icone.xml', vetor(72, corpo))


def mascara(lado, forma):
    # Desenhada a 4x e reduzida, para a orla sair suave.
    grande = Image.new('L', (lado * 4, lado * 4), 0)
    desenho = ImageDraw.Draw(grande)
    if forma == 'redondo':
        desenho.ellipse((0, 0, lado * 4 - 1, lado * 4 - 1), fill=255)
    else:
        desenho.rounded_rectangle((0, 0, lado * 4 - 1, lado * 4 - 1), radius=lado * 4 * 0.18, fill=255)
    return grande.resize((lado, lado), Image.LANCZOS)


def pngs_antigos():
    origem = Image.open(RAIZ / 'icon-512.png').convert('RGBA')
    for nome, fator in DENSIDADES.items():
        lado = round(48 * fator)
        reduzido = origem.resize((lado, lado), Image.LANCZOS)
        for ficheiro, forma in (('ic_launcher.png', 'quadrado'), ('ic_launcher_round.png', 'redondo')):
            icone = reduzido.copy()
            icone.putalpha(mascara(lado, forma))
            icone.save(RES / f'mipmap-{nome}' / ficheiro, optimize=True)


if __name__ == '__main__':
    vetores()
    pngs_antigos()
    print('Ícones Android gerados em', RES)
