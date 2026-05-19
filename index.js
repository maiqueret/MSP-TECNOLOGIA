// CONFIGURAÇÃO INICIAL DO SUPABASE
const supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

let usuarioLogado = null;

// VERIFICAÇÃO AUTOMÁTICA DE SESSÃO AO CARREGAR A PÁGINA
document.addEventListener("DOMContentLoaded", async () => {
    const formLogin = document.getElementById("form-login");
    if (formLogin) {
        formLogin.addEventListener("submit", executarLogin);
    }

    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session) {
        document.getElementById("tela-login").classList.remove("hidden");
        document.getElementById("app-conteudo").classList.add("hidden");
    } else {
        usuarioLogado = session.user;
        liberarAcessoAplicativo();
    }
});

function toggleSenha() {
    const campoSenha = document.getElementById("login-senha");
    if (campoSenha.type === "password") {
        campoSenha.type = "text";
    } else {
        campoSenha.type = "password";
    }
}

async function executarLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const senha = document.getElementById("login-senha").value;
    const erroDiv = document.getElementById("login-erro");
    
    erroDiv.classList.add("hidden");
    erroDiv.innerText = "";

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });

    if (error) {
        if (error.message.includes("Invalid login credentials")) {
            erroDiv.innerText = "❌ E-mail ou senha incorretos!";
        } else {
            erroDiv.innerText = "⚠️ Resposta do Banco: " + error.message;
        }
        erroDiv.classList.remove("hidden");
    } else {
        usuarioLogado = data.user;
        liberarAcessoAplicativo();
    }
}

function liberarAcessoAplicativo() {
    document.getElementById("tela-login").classList.add("hidden");
    document.getElementById("app-conteudo").classList.remove("hidden");
    
    verificarConexao();
    carregarDadosDashboard();
    listarClientes();
    listarProdutos();
    carregarSeletores();
    listarVendas();
    listarOrdens();
    
    const hojeStr = new Date().toISOString().split('T')[0];
    if(document.getElementById('rep-data-inicio')) document.getElementById('rep-data-inicio').value = hojeStr.substring(0,8) + '01';
    if(document.getElementById('rep-data-fim')) document.getElementById('rep-data-fim').value = hojeStr;
}

async function executarLogoff() {
    await supabaseClient.auth.signOut();
    usuarioLogado = null;
    window.location.reload();
}

function mudarAba(aba) {
    const telas = ['dashboard', 'clientes', 'produtos', 'vendas', 'ordens', 'relatorios'];
    telas.forEach(t => {
        const elTela = document.getElementById(`tela-${t}`);
        const elBtn = document.getElementById(`btn-${t}`);
        if (elTela) elTela.classList.add('hidden');
        if (elBtn) elBtn.className = "inline-flex md:flex w-auto md:w-full items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-slate-800 hover:text-white font-medium text-xs md:text-sm transition-all cursor-pointer text-slate-300";
    });

    const telaAtiva = document.getElementById(`tela-${aba}`);
    const btnAtivo = document.getElementById(`btn-${aba}`);
    if (telaAtiva) telaAtiva.classList.remove('hidden');
    if (btnAtivo) btnAtivo.className = "inline-flex md:flex w-auto md:w-full items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg bg-blue-600 text-white font-medium text-xs md:text-sm transition-all cursor-pointer";

    document.getElementById('titulo-pagina').innerText = aba === 'dashboard' ? "📊 Dashboard" : aba === 'clientes' ? "👥 Clientes" : aba === 'produtos' ? "📦 Estoque Peças" : aba === 'vendas' ? "🛒 Balcão Caixa" : aba === 'ordens' ? "📋 Ordens Serv." : "📈 Relatórios";
}

// TESTE DE CONEXÃO
async function verificarConexao() {
    try {
        await supabaseClient.from('clientes').select('id').limit(1);
        document.getElementById('status-conexao').innerHTML = "✅ Conectado";
    } catch (err) {
        document.getElementById('status-conexao').innerHTML = "❌ Sem Conexão";
    }
}

// ATUALIZAÇÃO DO DASHBOARD
async function carregarDadosDashboard() {
    try {
        const { count: qtdClientes } = await supabaseClient.from('clientes').select('*', { count: 'exact', head: true });
        document.getElementById('dash-qtd-clientes').innerText = qtdClientes || 0;
        const { count: qtdProdutos } = await supabaseClient.from('produtos').select('*', { count: 'exact', head: true });
        document.getElementById('dash-qtd-produtos').innerText = qtdProdutos || 0;
        const { count: qtdOS } = await supabaseClient.from('ordens_servico').select('*', { count: 'exact', head: true });
        document.getElementById('dash-qtd-os').innerText = qtdOS || 0;

        const { data: vendas } = await supabaseClient.from('vendas_balcao').select('total_venda, created_at');
        let totalGeral = 0, totalMes = 0, totalHoje = 0;
        const hojeObj = new Date();
        const hojeAno = hojeObj.getFullYear();
        const hojeMes = hojeObj.getMonth();
        const hojeDia = hojeObj.getDate();

        if (vendas) {
            vendas.forEach(v => {
                const valorVenda = parseFloat(v.total_venda) || 0;
                totalGeral += valorVenda;
                const dataVenda = new Date(v.created_at);
                if (!isNaN(dataVenda.getTime())) {
                    if (dataVenda.getFullYear() === hojeAno && dataVenda.getMonth() === hojeMes) {
                        totalMes += valorVenda;
                        if (dataVenda.getDate() === hojeDia) totalHoje += valorVenda;
                    }
                }
            });
        }
        document.getElementById('dash-faturamento').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-faturamento-mes').innerText = `R$ ${totalMes.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-faturamento-dia').innerText = `R$ ${totalHoje.toFixed(2).replace('.', ',')}`;
    } catch(e){}
}

// ==========================================
// SEÇÃO DE CLIENTES
// ==========================================
if (document.getElementById('form-cliente')) {
    document.getElementById('form-cliente').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('cli-nome').value;
        const telefone = document.getElementById('cli-telefone').value;
        const cpf_cnpj = document.getElementById('cli-cpf').value;
        const endereco = document.getElementById('cli-endereco').value;
        const cidade = document.getElementById('cli-cidade').value;

        await supabaseClient.from('clientes').insert([{ nome, telefone, cpf_cnpj, endereco, city: cidade }]);
        document.getElementById('form-cliente').reset();
        listarClientes(); carregarDadosDashboard(); carregarSeletores();
    });
}

async function listarClientes() {
    try {
        const busca = document.getElementById('busca-cliente')?.value.toLowerCase() || "";
        const { data: lista } = await supabaseClient.from('clientes').select('*').order('nome', { ascending: true });
        const corpo = document.getElementById('tabela-clientes-corpo');
        if (!corpo) return;
        corpo.innerHTML = "";
        if (lista) {
            lista.forEach(c => {
                if (c.nome.toLowerCase().includes(busca) || (c.telefone && c.telefone.includes(busca))) {
                    corpo.innerHTML += `
                        <tr class="hover:bg-gray-50 border-b border-gray-100">
                            <td class="p-3 md:p-4 font-medium text-gray-900">${c.nome}</td>
                            <td class="p-3 md:p-4 text-slate-600 font-mono text-xs">${c.cpf_cnpj || 'Sem registro'}</td>
                            <td class="p-3 md:p-4 text-xs text-gray-500">📍 ${c.endereco || ''} - ${c.city || ''}<br>📞 ${c.telefone || 'S/T'}</td>
                            <td class="p-3 md:p-4 text-center"><button onclick="deletarItem('clientes', '${c.id}', listarClientes)" class="text-red-600 hover:text-red-900 font-medium cursor-pointer px-2 py-1 rounded hover:bg-red-50">Excluir</button></td>
                        </tr>`;
                }
            });
        }
    } catch(e){}
}

// ==========================================
// SEÇÃO DE PRODUTOS / PEÇAS
// ==========================================
if (document.getElementById('form-produto')) {
    document.getElementById('form-produto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('prod-nome').value;
        const preco = parseFloat(document.getElementById('prod-preco').value);
        const estoque = parseInt(document.getElementById('prod-estoque').value);
        await supabaseClient.from('produtos').insert([{ nome, preco, estoque }]);
        document.getElementById('form-produto').reset();
        listarProdutos(); carregarDadosDashboard(); carregarSeletores();
    });
}

async function listarProdutos() {
    try {
        const busca = document.getElementById('busca-produto')?.value.toLowerCase() || "";
        const { data: lista } = await supabaseClient.from('produtos').select('*').order('nome', { ascending: true });
        const corpo = document.getElementById('tabela-produtos-corpo');
        if (!corpo) return;
        corpo.innerHTML = "";
        if (lista) {
            lista.forEach(p => {
                if (p.nome.toLowerCase().includes(busca)) {
                    const estoqueAlerta = p.estoque <= 2 ? 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100' : 'text-gray-600';
                    corpo.innerHTML += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="p-3 md:p-4 font-medium text-gray-900">${p.nome}</td><td class="p-3 md:p-4 font-mono text-gray-700">R$ ${p.preco.toFixed(2).replace('.', ',')}</td><td class="p-3 md:p-4"><span class="${estoqueAlerta}">${p.estoque} un</span></td><td class="p-3 md:p-4 text-center space-x-2"><button onclick="abrirModalEditar('${p.id}', '${p.nome}', ${p.preco}, ${p.estoque})" class="text-blue-600 hover:text-blue-900 font-medium cursor-pointer px-2 py-1 rounded hover:bg-blue-50">Editar</button><button onclick="deletarItem('produtos', '${p.id}', listarProdutos)" class="text-red-600 hover:text-red-900 font-medium cursor-pointer px-2 py-1 rounded hover:bg-red-50">Excluir</button></td></tr>`;
                }
            });
        }
    } catch(e){}
}

function abrirModalEditar(id, nome, preco, estoque) {
    document.getElementById('edit-prod-id').value = id;
    document.getElementById('edit-prod-nome').value = nome;
    document.getElementById('edit-prod-preco').value = preco;
    document.getElementById('edit-prod-estoque').value = estoque;
    document.getElementById('modal-editar-produto').classList.remove('hidden');
}
function fecharModalEditar() { document.getElementById('modal-editar-produto').classList.add('hidden'); }

async function salvarEdicaoProduto() {
    const id = document.getElementById('edit-prod-id').value;
    const nome = document.getElementById('edit-prod-nome').value;
    const preco = parseFloat(document.getElementById('edit-prod-preco').value);
    const estoque = parseInt(document.getElementById('edit-prod-estoque').value);
    await supabaseClient.from('produtos').update({ nome, preco, estoque }).eq('id', id);
    fecharModalEditar(); listarProdutos(); carregarDadosDashboard(); carregarSeletores();
}

// ==========================================
// SEÇÃO DE VENDAS DE BALCÃO
// ==========================================
async function carregarSeletores() {
    try {
        const { data: clientes } = await supabaseClient.from('clientes').select('id, nome').order('nome');
        const { data: produtos } = await supabaseClient.from('produtos').select('id, nome, preco, estoque').order('nome');
        const selCliVenda = document.getElementById('vd-cliente');
        const selProdVenda = document.getElementById('vd-produto');
        const selCliOS = document.getElementById('os-cliente');

        if (selCliVenda && clientes) {
            selCliVenda.innerHTML = `<option value="">-- Selecione o Cliente --</option>`;
            clientes.forEach(c => selCliVenda.innerHTML += `<option value="${c.id}">${c.nome}</option>`);
        }
        if (selCliOS && clientes) {
            selCliOS.innerHTML = `<option value="">-- Selecione o Cliente --</option>`;
            clientes.forEach(c => selCliOS.innerHTML += `<option value="${c.id}">${c.nome}</option>`);
        }
        if (selProdVenda && produtos) {
            selProdVenda.innerHTML = `<option value="">-- Escolha o Item --</option>`;
            produtos.forEach(p => {
                const desabilitado = p.estoque <= 0 ? 'disabled' : '';
                const textoEstoque = p.estoque <= 0 ? '(ESGOTADO)' : `(Estoque: ${p.estoque})`;
                selProdVenda.innerHTML += `<option value="${p.id}" data-preco="${p.preco}" data-estoque="${p.estoque}" ${desabilitado}>${p.nome} - R$ ${p.preco.toFixed(2)} ${textoEstoque}</option>`;
            });
        }
    } catch(e){}
}

async function executarVendaBalcao() {
    const clienteId = document.getElementById('vd-cliente').value;
    const produtoId = document.getElementById('vd-produto').value;
    const qtd = parseInt(document.getElementById('vd-qtd').value) || 1;
    const valorMaoDeObra = parseFloat(document.getElementById('vd-valor-servico').value) || 0;
    const descricaoServico = document.getElementById('vd-descricao-servico').value;

    if (!clienteId || !produtoId) { alert("Escolha o cliente e o item!"); return; }

    const seletor = document.getElementById('vd-produto');
    const opcao = seletor.options[seletor.selectedIndex];
    const precoUn = parseFloat(opcao.getAttribute('data-preco'));
    const estoqueAtual = parseInt(opcao.getAttribute('data-estoque'));

    if (qtd > estoqueAtual) { alert(`Quantidade insuficiente!`); return; }
    const totalVendaCalculada = (precoUn * qtd) + valorMaoDeObra;

    try {
        const { error } = await supabaseClient.from('vendas_balcao').insert([{
            cliente_id: clienteId, 
            produto_id: produtoId, 
            quantidade: qtd, 
            valor_servico: valorMaoDeObra, 
            total_venda: totalVendaCalculada,
            descricao_servico: descricaoServico
        }]);
        if (error) throw error;
        await supabaseClient.from('produtos').update({ estoque: estoqueAtual - qtd }).eq('id', produtoId);
        document.getElementById('vd-produto').value = ""; document.getElementById('vd-qtd').value = "1"; document.getElementById('vd-valor-servico').value = "0.00"; document.getElementById('vd-descricao-servico').value = "";
        listarVendas(); listarProdutos(); carregarDadosDashboard(); carregarSeletores();
        alert("Venda realizada com sucesso!");
    } catch (e) {
        console.error(e);
    }
}

async function listarVendas() {
    try {
        const { data: vendas, error } = await supabaseClient.from('vendas_balcao').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        const { data: clientesLista } = await supabaseClient.from('clientes').select('id, nome, telefone');
        const { data: produtosLista } = await supabaseClient.from('produtos').select('id, nome, preco');

        const corpo = document.getElementById('tabela-vendas-corpo');
        if (!corpo) return; corpo.innerHTML = "";

        if (vendas && vendas.length > 0) {
            vendas.forEach(v => {
                const dataFmt = new Date(v.created_at).toLocaleString('pt-BR');
                const totalItem = parseFloat(v.total_venda) || 0;
                
                const cli = clientesLista ? clientesLista.find(c => String(c.id) === String(v.cliente_id)) : null;
                const prod = produtosLista ? produtosLista.find(p => String(p.id) === String(v.produto_id)) : null;

                const clienteNome = cli ? cli.nome : 'Cliente Código: ' + v.cliente_id;
                const pecaTexto = prod ? `📦 ${prod.nome} (x${v.quantidade})` : 'Item Código: ' + v.produto_id;
                const servicoTexto = v.descricao_servico ? `<br><span class="text-slate-500">🔧 ${v.descricao_servico}</span>` : '';
                
                const dadosRecibo = JSON.stringify({
                    id: v.id, data: dataFmt, cliente: cli ? cli.nome : 'Cliente', telefone: cli ? cli.telefone : '', item: prod ? prod.nome : 'Item', qtd: v.quantidade, valor_item: prod ? prod.preco : 0, mao_obra: v.valor_servico, total: totalItem, servico: v.descricao_servico || ''
                }).replace(/"/g, '&quot;');

                corpo.innerHTML += `
                    <tr class="hover:bg-gray-50 border-b border-gray-100">
                        <td class="p-3 md:p-4 font-mono text-gray-600">${dataFmt}</td>
                        <td class="p-3 md:p-4 font-semibold text-gray-900">${clienteNome}</td>
                        <td class="p-3 md:p-4 text-xs text-gray-700">${pecaTexto} ${servicoTexto}</td>
                        <td class="p-3 md:p-4 font-bold text-emerald-600 font-mono">R$ ${totalItem.toFixed(2).replace('.', ',')}</td>
                        <td class="p-3 md:p-4 text-center space-x-2">
                            <button onclick="imprimirReciboVenda(${dadosRecibo})" class="text-blue-600 hover:text-blue-800 text-xs font-bold cursor-pointer bg-blue-50 px-2 py-1 rounded border border-blue-200">🖨️ Recibo</button>
                            <button onclick="deletarItem('vendas_balcao', '${v.id}', listarVendas)" class="text-red-500 hover:text-red-800 cursor-pointer text-xs font-medium">Estornar</button>
                        </td>
                    </tr>`;
            });
        } else {
            corpo.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhuma venda listada no histórico do caixa.</td></tr>`;
        }
    } catch (e) {
        console.error(e);
    }
}

function imprimirReciboVenda(v) {
    const janelaImpressao = window.open('', '', 'width=600,height=700');
    janelaImpressao.document.write(`<html><head><title>Recibo</title><style>body { font-family: monospace; padding: 20px; } .flex { display: flex; justify-content: space-between; }</style></head><body><h3 style="text-align:center">MSP TECNOLOGIA</h3><p><b>Cupom:</b> BAL-${v.id}</p><p><b>Data:</b> ${v.data}</p><p><b>Cliente:</b> ${v.cliente}</p><hr><div class="flex"><span>${v.qtd}x ${v.item}</span><span>R$ ${(v.valor_item * v.qtd).toFixed(2)}</span></div>${v.servico ? `<div>🔧 <b>Serviço:</b> ${v.servico}</div>` : ''}${parseFloat(v.mao_obra) > 0 ? `<div class="flex"><span>🔧 Mão de Obra</span><span>R$ ${parseFloat(v.mao_obra).toFixed(2)}</span></div>` : ''}<hr><div class="flex"><b>TOTAL:</b><b>R$ ${parseFloat(v.total).toFixed(2)}</b></div><script>window.print(); window.close();</script></body></html>`);
    janelaImpressao.document.close();
}

// ==========================================
// SEÇÃO DE ORDENS DE SERVIÇO
// ==========================================
async function finalizarOperacao() {
    const clienteId = document.getElementById('os-cliente').value;
    const status = document.getElementById('os-status').value;
    const equipamento = document.getElementById('os-equipamento').value;
    const descricao = document.getElementById('os-descricao').value;

    if (!clienteId || !equipamento || !descricao) { alert("Preencha todos os campos!"); return; }

    try {
        const { error } = await supabaseClient.from('ordens_servico').insert([{ 
            cliente_id: clienteId, status, descricao_equipamento: equipamento, defeito_relatado: descricao 
        }]);
        if(error) throw error;
        document.getElementById('os-equipamento').value = ""; document.getElementById('os-descricao').value = "";
        listarOrdens(); carregarDadosDashboard();
        alert("Ordem de serviço aberta com sucesso!");
    } catch(e){}
}

async function listarOrdens() {
    try {
        const { data: ordens, error: erroOS } = await supabaseClient.from('ordens_servico').select('*').order('created_at', { ascending: false });
        if (erroOS) throw erroOS;

        const { data: clientesLista } = await supabaseClient.from('clientes').select('id, nome, telefone, cpf_cnpj, endereco, city');

        const corpo = document.getElementById('tabela-ordens-corpo');
        if (!corpo) return; 
        corpo.innerHTML = "";

        if (ordens && ordens.length > 0) {
            ordens.forEach(o => {
                const dataFmt = new Date(o.created_at).toLocaleDateString('pt-BR');
                const statusFmt = (o.status || "").trim().toLowerCase();
                let valorSelect = "Em Análise", badgeColor = "bg-gray-100 text-gray-800";

                if (statusFmt.includes("andamento") || statusFmt.includes("bancada")) { valorSelect = "Em Andamento"; badgeColor = "bg-amber-100 text-amber-800"; }
                else if (statusFmt.includes("peca") || statusFmt.includes("sem")) { valorSelect = "Aguardando Peça"; badgeColor = "bg-purple-100 text-purple-800"; }
                else if (statusFmt.includes("concluid") || statusFmt.includes("pronto")) { valorSelect = "Concluido"; badgeColor = "bg-green-100 text-green-800"; }

                const clienteEncontrado = clientesLista ? clientesLista.find(c => String(c.id) === String(o.cliente_id)) : null;

                const dadosOSPrint = JSON.stringify({
                    id: o.id, data: dataFmt,
                    cliente: clienteEncontrado ? clienteEncontrado.nome : 'Cliente Código: ' + o.cliente_id,
                    telefone: clienteEncontrado ? clienteEncontrado.telefone : 'Não informado',
                    cpf: clienteEncontrado ? (clienteEncontrado.cpf_cnpj || 'Não informado') : 'Não informado',
                    local: clienteEncontrado ? `${clienteEncontrado.endereco || ''} - ${clienteEncontrado.city || ''}` : 'Não informado',
                    equipamento: o.descricao_equipamento, defeito: o.defeito_relatado, status: o.status || 'Em Análise'
                }).replace(/"/g, '&quot;');

                corpo.innerHTML += `
                    <tr class="hover:bg-gray-50 border-b border-gray-100">
                        <td class="p-3 md:p-4 font-mono text-gray-500">OS-${o.id}</td>
                        <td class="p-3 md:p-4 font-bold text-gray-900">${clienteEncontrado ? clienteEncontrado.nome : 'Cliente ID: ' + o.cliente_id}</td>
                        <td class="p-3 md:p-4">
                            <select onchange="atualizarStatusOS('${o.id}', this.value)" class="text-xs font-semibold px-2 py-1 rounded-md border border-gray-200 ${badgeColor} focus:outline-none cursor-pointer">
                                <option value="Em Análise" ${valorSelect === 'Em Análise' ? 'selected' : ''}>⏳ Em Análise</option>
                                <option value="Em Andamento" ${valorSelect === 'Em Andamento' ? 'selected' : ''}>🛠️ Na Bancada</option>
                                <option value="Aguardando Peça" ${valorSelect === 'Aguardando Peça' ? 'selected' : ''}>📦 Sem Peça</option>
                                <option value="Concluido" ${valorSelect === 'Concluido' ? 'selected' : ''}>✅ Concluído</option>
                            </select>
                        </td>
                        <td class="p-3 md:p-4 text-xs"><span class="font-semibold text-slate-800">${o.descricao_equipamento}</span><br><span class="text-gray-500">${o.defeito_relatado}</span></td>
                        <td class="p-3 md:p-4 text-center space-x-1 whitespace-nowrap">
                            <button onclick="imprimirLaudoOS(${dadosOSPrint})" class="text-blue-600 hover:text-blue-900 font-bold text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200 cursor-pointer">🖨️ Via A4</button>
                            <button onclick="deletarItem('ordens_servico', '${o.id}', listarOrdens)" class="text-red-500 hover:text-red-800 cursor-pointer text-xs">Remover</button>
                        </td>
                    </tr>`;
            });
        } else {
            corpo.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500 italic">Nenhum registro no quadro de acompanhamento técnico.</td></tr>`;
        }
    } catch(e) {
        console.error("Erro fatal ao listar ordens:", e);
    }
}

async function atualizarStatusOS(id, novoStatus) {
    await supabaseClient.from('ordens_servico').update({ status: novoStatus }).eq('id', id);
    listarOrdens(); carregarDadosDashboard();
}

function imprimirLaudoOS(os) {
    const windowLaudo = window.open('', '', 'width=800,height=900');
    windowLaudo.document.write(`
        <html><head><title>Ordem de Serviço</title><style>body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; } .topo { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 30px; } .secao { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; } .secao-titulo { font-size: 14px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 10px; } .grid { display: flex; justify-content: space-between; flex-wrap: wrap; } .grid div { width: 48%; margin-bottom: 10px; font-size: 14px; } .campo-texto { min-height: 80px; font-size: 14px; background: white; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 4px; } .assinaturas { margin-top: 60px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; } .linha-assinatura { border-top: 1px solid #333; width: 250px; margin-bottom: 5px; }</style></head><body>
            <div class="topo"><div><div style="font-size:24px;font-bold">MSP TECNOLOGIA</div><div style="color:#2563eb;font-weight:bold">COMPROVANTE DE ORDEM DE SERVIÇO</div></div><div style="text-align:right;font-size:12px"><b>MSP Tecnologia & Assistência</b><br>Irecê - Bahia<br>Contato: (74) 99995-0922</div></div>
            <div class="secao"><div class="secao-titulo">1. Identificação do Chamado</div><div class="grid"><b>Controle OS:</b> OS-${os.id}</div><div><b>Data Entrada:</b> ${os.data}</div><div><b>Situação:</b> ${os.status}</div><div><b>Técnico:</b> Maique Pereira</div></div></div>
            <div class="secao"><div class="secao-titulo">2. Informações do Cliente</div><div class="grid"><div><b>Nome:</b> ${os.cliente}</div><div><b>Contato:</b> ${os.telefone}</div><div><b>CPF/CNPJ:</b> ${os.cpf}</div><div><b>Endereço:</b> ${os.local}</div></div></div>
            <div class="secao"><div class="secao-titulo">3. Equipamento</div><div class="grid"><div style="width:100%"><b>Descrição:</b> ${os.equipamento}</div></div></div>
            <div class="secao"><div class="secao-titulo">4. Ocorrência Relatada</div><div class="campo-texto">${os.defeito}</div></div>
            <div class="secao"><div class="secao-titulo">5. Parecer de Bancada / Peças Aplicadas</div><div class="campo-texto" style="color:#94a3b8;font-style:italic">Preenchimento manual de laudo técnico técnico...</div></div>
            <div class="assinaturas"><div><div class="linha-assinatura"></div>MSP Tecnologia</div><div><div class="linha-assinatura"></div>Assinatura Cliente</div></div>
            <script>window.print(); window.close();</script>
        </body></html>
    `);
    windowLaudo.document.close();
}

// ==========================================
// RELATÓRIOS FILTRADOS
// ==========================================
async function gerarRelatorioFiltrado() {
    const dataInicioStr = document.getElementById('rep-data-inicio').value;
    const dataFimStr = document.getElementById('rep-data-fim').value;
    const corpo = document.getElementById('tabela-relatorios-corpo');
    if (!dataInicioStr || !dataFimStr) { alert("Selecione as duas datas!"); return; }
    corpo.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-blue-600 animate-pulse">🔎 Processando...</td></tr>`;

    try {
        const { data: vendas, error } = await supabaseClient.from('vendas_balcao').select(`id, created_at, quantidade, total_venda, produtos(nome, preco)`).order('created_at', { ascending: true });
        if (error) throw error;
        const limiteInicio = new Date(dataInicioStr + 'T00:00:00'), limiteFim = new Date(dataFimStr + 'T23:59:59');
        let somaPecas = 0, somaGeral = 0, htmlLinhas = "";

        if (vendas) {
            vendas.forEach(v => {
                const dataVenda = new Date(v.created_at);
                if (dataVenda >= limiteInicio && dataVenda <= limiteFim) {
                    const totalLiquido = parseFloat(v.total_venda) || 0;
                    const precoOriginalPeca = v.produtos ? (parseFloat(v.produtos.preco) || 0) * (parseInt(v.quantidade) || 1) : totalLiquido;
                    somaPecas += precoOriginalPeca; somaGeral += totalLiquido;
                    htmlLinhas += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="p-3 font-mono">${dataVenda.toLocaleDateString('pt-BR')}</td><td class="p-3 font-semibold">Balcão</td><td class="p-3 text-xs">${v.produtos?.nome || 'Geral'}</td><td class="p-3 font-mono">R$ ${(totalLiquido - precoOriginalPeca).toFixed(2)}</td><td class="p-3 font-mono font-bold text-emerald-600">R$ ${totalLiquido.toFixed(2)}</td></tr>`;
                }
            });
        }
        corpo.innerHTML = htmlLinhas || `<tr><td colspan="5" class="p-6 text-center text-gray-500 italic">Nenhuma movimentação.</td></tr>`;
        document.getElementById('rep-total-pecas').innerText = `R$ ${somaPecas.toFixed(2).replace('.', ',')}`;
        document.getElementById('rep-total-servicos').innerText = `R$ ${(somaGeral - somaPecas).toFixed(2).replace('.', ',')}`;
        document.getElementById('rep-total-geral').innerText = `R$ ${somaGeral.toFixed(2).replace('.', ',')}`;
    } catch(e){}
}

async function deletarItem(tabela, id, callbackSucesso) {
    if (!confirm("Deseja realmente excluir permanentemente?")) return;
    const { error } = await supabaseClient.from(tabela).delete().eq('id', id);
    if (error) alert("Erro ao deletar: " + error.message);
    else { callbackSucesso(); carregarDadosDashboard(); carregarSeletores(); }
}
