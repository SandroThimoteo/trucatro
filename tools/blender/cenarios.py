# Gera os cenários 3D do jogo (fundo das cenas dos Chefões e cenários do Bazar).
# Uso: blender --background --factory-startup --python tools/blender/cenarios.py -- <pasta-saida> [ids...]
# Cada cenário é o mesmo boteco com outra luz, outra parede e outros objetos na mesa.
import bpy, math, random, sys, os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAIDA = os.path.abspath(argv[0] if argv else 'assets/cenarios')
SO = set(argv[1:])
os.makedirs(SAIDA, exist_ok=True)

# id: (parede, piso, luz da lâmpada, força, luz de fundo, garrafas, extra)
CENARIOS = {
    # Cenas dos Chefões
    'chefe_dona_cotinha':      ((0.55, 0.42, 0.30), (0.25, 0.16, 0.10), (1.0, 0.80, 0.55), 900, (1.0, 0.6, 0.8), 6, 'tricô'),
    'chefe_o_gringo':          ((0.20, 0.35, 0.45), (0.18, 0.14, 0.10), (0.7, 0.9, 1.0), 900, (0.2, 0.6, 1.0), 8, 'mapa'),
    'chefe_mao_de_pilao':      ((0.45, 0.12, 0.10), (0.15, 0.10, 0.08), (1.0, 0.45, 0.25), 1300, (1.0, 0.2, 0.1), 5, 'ringue'),
    'chefe_delegado_nogueira': ((0.18, 0.20, 0.22), (0.12, 0.12, 0.13), (0.9, 0.95, 1.0), 1500, (0.3, 0.3, 0.5), 4, 'chapeu'),
    'chefe_viuva_negra':       ((0.15, 0.05, 0.12), (0.08, 0.04, 0.06), (0.9, 0.3, 0.6), 900, (0.6, 0.0, 0.4), 7, 'velas'),
    'chefe_seu_lunatico':      ((0.08, 0.08, 0.22), (0.07, 0.07, 0.12), (0.6, 0.6, 1.0), 800, (0.4, 0.3, 1.0), 5, 'lua'),
    'chefe_tia_zulmira':       ((0.40, 0.45, 0.30), (0.20, 0.17, 0.12), (1.0, 0.95, 0.75), 900, (0.6, 0.9, 0.5), 6, 'tricô'),
    'chefe_rei_do_truco':      ((0.35, 0.05, 0.05), (0.10, 0.06, 0.04), (1.0, 0.82, 0.35), 1800, (1.0, 0.7, 0.1), 10, 'coroa'),
    # Cenários do Bazar (fundo da tela)
    'cenario_boteco':          ((0.55, 0.50, 0.38), (0.22, 0.15, 0.10), (1.0, 0.85, 0.6), 1000, (1.0, 0.7, 0.4), 8, ''),
    'cenario_neon':            ((0.05, 0.05, 0.08), (0.04, 0.04, 0.06), (1.0, 0.2, 0.7), 1100, (0.1, 0.9, 1.0), 9, 'velas'),
    'cenario_junino':          ((0.70, 0.45, 0.20), (0.30, 0.18, 0.08), (1.0, 0.6, 0.25), 1200, (1.0, 0.4, 0.1), 5, 'bandeirinhas'),
    'cenario_madrugada':       ((0.10, 0.14, 0.20), (0.06, 0.07, 0.09), (0.55, 0.7, 1.0), 600, (0.2, 0.3, 0.8), 6, 'lua'),
    'cenario_cassino':         ((0.05, 0.22, 0.12), (0.10, 0.05, 0.04), (1.0, 0.9, 0.7), 1400, (1.0, 0.8, 0.2), 10, 'coroa'),
}


def limpar():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(nome, cor, rugosidade=0.6, metal=0.0, emissao=0.0, transm=0.0, alfa=1.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*cor, 1)
    b.inputs['Roughness'].default_value = rugosidade
    b.inputs['Metallic'].default_value = metal
    if emissao:
        b.inputs['Emission Color'].default_value = (*cor, 1)
        b.inputs['Emission Strength'].default_value = emissao
    if transm:
        b.inputs['Transmission Weight'].default_value = transm
    if alfa < 1:
        b.inputs['Alpha'].default_value = alfa
    return m


def obj(o, m=None, nome=None):
    if m:
        o.data.materials.append(m)
    if nome:
        o.name = nome
    return o


def cubo(loc, esc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = esc
    return obj(o, m)


def cilindro(loc, r, h, m, verts=32, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.object
    bpy.ops.object.shade_smooth()
    return obj(o, m)


def azulejo(cor):
    # Parede com azulejos: xadrez procedural misturando a cor com um tom mais claro
    m = bpy.data.materials.new('parede')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    ch = nt.nodes.new('ShaderNodeTexChecker')
    ch.inputs['Scale'].default_value = 14
    ch.inputs['Color1'].default_value = (*cor, 1)
    ch.inputs['Color2'].default_value = (*(min(1, c * 1.35 + 0.05) for c in cor), 1)
    nt.links.new(ch.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.35
    return m


def montar(cid, cfg):
    parede, piso, luz, forca, fundo, nGarrafas, extra = cfg
    rnd = random.Random(cid)
    limpar()
    cena = bpy.context.scene

    # Piso, parede, balcão e prateleira
    bpy.ops.mesh.primitive_plane_add(size=30)
    obj(bpy.context.object, mat('piso', piso, 0.8))
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 6, 0), rotation=(math.pi / 2, 0, 0))
    obj(bpy.context.object, azulejo(parede))
    madeira = mat('madeira', (0.30, 0.15, 0.07), 0.5)
    cubo((0, 4.2, 0.55), (4.5, 0.6, 0.55), madeira)
    cubo((0, 4.2, 1.12), (4.7, 0.7, 0.04), mat('tampo', (0.12, 0.06, 0.03), 0.25))
    cubo((0, 5.85, 2.3), (3.6, 0.15, 0.04), madeira)
    cubo((0, 5.85, 3.1), (3.6, 0.15, 0.04), madeira)

    # Garrafas na prateleira (vidro colorido)
    cores = [(0.1, 0.5, 0.15), (0.6, 0.3, 0.05), (0.9, 0.85, 0.7), (0.5, 0.05, 0.05), (0.1, 0.2, 0.6)]
    for i in range(nGarrafas):
        prat = 2.34 if i % 2 == 0 else 3.14
        x = -3.2 + i * (6.4 / max(1, nGarrafas - 1))
        h = rnd.uniform(0.45, 0.65)
        vidro = mat(f'vidro{i}', rnd.choice(cores), 0.08, transm=0.85)
        cilindro((x, 5.85, prat + h / 2), 0.11, h, vidro)
        cilindro((x, 5.85, prat + h + 0.1), 0.04, 0.2, vidro)

    # Mesa redonda de boteco com toalha xadrez, cartas e tampinhas
    cilindro((0, 0.6, 0.75), 1.5, 0.08, mat('mesa', (0.75, 0.1, 0.08), 0.7), verts=64)
    cilindro((0, 0.6, 0.37), 0.1, 0.74, mat('pe', (0.2, 0.2, 0.2), 0.3, metal=1))
    papel = mat('carta', (0.95, 0.92, 0.82), 0.6)
    verso = mat('verso', (0.55, 0.08, 0.06), 0.5)
    for i in range(5):
        cubo((-0.6 + i * 0.3, 0.3 + rnd.uniform(-0.1, 0.1), 0.8 + i * 0.003), (0.16, 0.23, 0.004), papel if i % 2 else verso, rot=(0, 0, rnd.uniform(-0.5, 0.5)))
    metal = mat('tampinha', (0.85, 0.75, 0.2), 0.25, metal=1)
    for i in range(7):
        a = rnd.uniform(0, math.pi * 2)
        cilindro((0.6 + math.cos(a) * rnd.uniform(0, 0.35), 0.8 + math.sin(a) * rnd.uniform(0, 0.35), 0.81 + i * 0.012), 0.07, 0.02, metal, verts=21)
    # garrafa de cerveja e copo americano
    ambar = mat('ambar', (0.45, 0.2, 0.02), 0.05, transm=0.9)
    cilindro((-0.9, 1.1, 1.12), 0.14, 0.6, ambar)
    cilindro((-0.9, 1.1, 1.55), 0.05, 0.3, ambar)
    cilindro((-0.5, 1.2, 0.95), 0.09, 0.28, mat('copo', (0.95, 0.85, 0.5), 0.02, transm=0.95))

    # Extras de cada cenário
    if extra == 'coroa':
        ouro = mat('ouro', (1.0, 0.75, 0.2), 0.2, metal=1)
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.35, radius2=0.45, depth=0.3, location=(0.3, 1.3, 0.97))
        obj(bpy.context.object, ouro)
    elif extra == 'velas':
        for i in range(3):
            cilindro((-1.0 + i * 1.0, 4.2, 1.35), 0.05, 0.4, mat(f'vela{i}', (0.95, 0.9, 0.85), 0.6))
            bpy.ops.object.light_add(type='POINT', location=(-1.0 + i * 1.0, 4.1, 1.65))
            l = bpy.context.object.data
            l.energy = 40
            l.color = (1.0, 0.6, 0.3)
    elif extra == 'lua':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.6, location=(2.8, 5.9, 4.3))
        obj(bpy.context.object, mat('lua', (1.0, 0.95, 0.8), emissao=4))
    elif extra == 'bandeirinhas':
        cs = [(1, 0.2, 0.2), (0.2, 0.6, 1), (1, 0.85, 0.1), (0.2, 0.8, 0.3)]
        for i in range(16):
            x = -4 + i * 0.53
            bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.2, depth=0.01, location=(x, 3.0, 4.2 - 0.25 * math.sin(i / 15 * math.pi)), rotation=(math.pi / 2, 0, math.pi))
            obj(bpy.context.object, mat(f'b{i}', cs[i % 4], 0.6))
    elif extra == 'chapeu':
        preto = mat('feltro', (0.05, 0.05, 0.05), 0.8)
        cilindro((0.4, 1.2, 0.83), 0.4, 0.02, preto)
        cilindro((0.4, 1.2, 0.98), 0.24, 0.3, preto)
    elif extra in ('tricô', 'mapa', 'ringue'):
        cor = {'tricô': (0.8, 0.2, 0.4), 'mapa': (0.85, 0.8, 0.6), 'ringue': (0.8, 0.1, 0.1)}[extra]
        bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.1, location=(0.5, 1.2, 0.88))
        obj(bpy.context.object, mat('extra', cor, 0.9))

    # Lâmpada pendurada (a luz principal tem a cor do Chefão)
    cilindro((0, 0.6, 4.6), 0.01, 1.6, mat('fio', (0.02, 0.02, 0.02)))
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.55, radius2=0.08, depth=0.4, location=(0, 0.6, 3.7))
    obj(bpy.context.object, mat('cupula', (0.1, 0.3, 0.2), 0.4, metal=0.6))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(0, 0.6, 3.5))
    obj(bpy.context.object, mat('bulbo', luz, emissao=25))
    bpy.ops.object.light_add(type='SPOT', location=(0, 0.6, 3.45))
    spot = bpy.context.object
    spot.data.energy = forca
    spot.data.color = luz
    spot.data.spot_size = math.radians(85)
    spot.data.spot_blend = 0.6
    spot.data.shadow_soft_size = 0.3
    # Luz de fundo colorida na parede (dá o clima de cada um)
    bpy.ops.object.light_add(type='AREA', location=(0, 4.8, 4.5), rotation=(math.radians(-60), 0, 0))
    a = bpy.context.object
    a.data.energy = 1100
    a.data.color = fundo
    a.data.size = 8

    # Mundo escuro e câmera de frente para a mesa
    cena.world = bpy.data.worlds.new('mundo')
    cena.world.use_nodes = True
    cena.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.025, 0.022, 0.02, 1)
    bpy.ops.object.camera_add(location=(0, -5.2, 2.2), rotation=(math.radians(84), 0, 0))
    cam = bpy.context.object
    cam.data.lens = 24
    cena.camera = cam

    r = cena.render
    for motor in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            r.engine = motor
            break
        except TypeError:
            pass
    try:
        cena.eevee.taa_render_samples = 32
    except AttributeError:
        pass
    r.resolution_x, r.resolution_y = 1280, 720
    r.image_settings.file_format = 'JPEG'
    r.image_settings.quality = 78
    cena.view_settings.look = 'AgX - Punchy' if 'AgX - Punchy' in [i.name for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['look'].enum_items] else 'None'
    r.filepath = os.path.join(SAIDA, f'{cid}.jpg')
    bpy.ops.render.render(write_still=True)
    print('RENDER', r.filepath)


for cid, cfg in CENARIOS.items():
    if SO and cid not in SO:
        continue
    montar(cid, cfg)
