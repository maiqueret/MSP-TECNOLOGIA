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
    
    // Inicialização segura dos dados do app
    verificarConexao();
    carregarDadosDashboard();
    listarClientes();
    listarProdutos();
    carregarSeletores();
    listarVendas();
    listarOrdens();
    
    // Deixa os inputs de relatório com as datas padrão (mês atual)
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

    const titulos = {
        dashboard: "📊 Dashboard",
        clientes: "👥 Gerenciamento de Clientes",
        produtos: "📦 Estoque de Peças",
        vendas: "🛒 Balcão de Vendas",
        ordens: "📋 Quadro de Ordens de Serviço",
        relatorios: "📈 Relatórios de Fechamento"
    };
    document.getElementById('titulo-pagina').innerText = titulos[aba] || "Painel";
}

async function verificarConexao() {
    try {
        await supabaseClient.from('clientes').select('id').limit(1);
        document.getElementById('status-conexao').innerHTML = "✅ Conectado";
    } catch (err) {
        document.getElementById('status-conexao').innerHTML = "❌ Sem Conexão";
    }
}

// DASHBOARD SEGURO CONTRA ERRO 404 E CORREÇÃO DAS DATAS DIÁRIO/MENTAL
async function carregarDadosDashboard() {
    try {
        const { count: qtdClientes } = await supabaseClient.from('clientes').select('*', { count: 'exact', head: true });
        document.getElementById('dash-qtd-clientes').innerText = qtdClientes || 0;
    } catch(e) { console.error("Tabela clientes inacessível", e); }

    try {
        const { count: qtdProdutos } = await supabaseClient.from('produtos').select('*', { count: 'exact', head: true });
        document.getElementById('dash-qtd-produtos').innerText = qtdProdutos || 0;
    } catch(e) { console.error("Tabela produtos inacessível", e); }

    try {
        const { count: qtdOS } = await supabaseClient.from('ordens_servico').select('*', { count: 'exact', head: true });
        document.getElementById('dash-qtd-os').innerText = qtdOS || 0;
    } catch(e) { console.error("Tabela ordens_servico inacessível ou inexistente", e); }

    try {
        const { data: vendas } = await supabaseClient.from('vendas_balcao').select('total_venda, created_at');
        
        let totalGeral = 0, totalMes = 0, totalHoje = 0;
        
        const hojeObj = new Date();
        const hojeAno = hojeObj.getFullYear();
        const hojeMes = hojeObj.getMonth(); // 0-11
        const hojeDia = hojeObj.getDate();

        if (vendas) {
            vendas.forEach(v => {
                const valor = parseFloat(v.total_venda) || 0;
                totalGeral += valor;
                
                // Converte de forma precisa a string timestamp para objeto Date local
                const dataVenda = new Date(v.created_at);
                if (!isNaN(dataVenda.getTime())) {
                    if (dataVenda.getFullYear() === hojeAno && dataVenda.getMonth() === hojeMes) {
                        totalMes += valor;
                        if (dataVenda.getDate() === hojeDia) {
                            totalHoje += valor;
                        }
                    }
                }
            });
        }

        document.getElementById('dash-faturamento').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-faturamento-mes').innerText = `R$ ${totalMes.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-faturamento-dia').innerText = `R$ ${totalHoje.toFixed(2).replace('.', ',')}`;
    } catch(e) { 
        console.error("Tabela vendas_balcao inacessível ou inexistente", e); 
    }
}

// ==========================================
// SEÇÃO DE CLIENTES
// ==========================================
if (document.getElementById('form-cliente')) {
    document.getElementById('form-cliente').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('cli-nome').value;
        const telefone = document.getElementById('cli-telefone').value;
        await supabaseClient.from('clientes').insert([{ nome, telefone }]);
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
                if (c.nome.toLowerCase().includes(busca) || c.telefone.includes(busca)) {
                    corpo.innerHTML += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="p-3 md:p-4 font-medium text-gray-900">${c.nome}</td><td class="p-3 md:p-4 text-gray-600">${c.telefone || 'Não informado'}</td><td class="p-3 md:p-4 text-center"><button onclick="deletarItem('clientes', '${c.id}', listarClientes)" class="text-red-600 hover:text-red-900 font-medium cursor-pointer px-2 py-1 rounded hover:bg-red-50">Excluir</button></td></tr>`;
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
            selProdVenda.innerHTML = `<option value="">-- Nenhuma peça aplicada (Apenas Mão de Obra) --</option>`;
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
    const produtoId = document.getElementById('vd-produto').value || null;
    const qtd = parseInt(document.getElementById('vd-qtd').value) || 1;
    const valorServico = parseFloat(document.getElementById('vd-valor-servico').value) || 0;
    const descricaoServico = document.getElementById('vd-descricao-servico').value;

    if (!clienteId) { alert("Escolha o cliente para fechar a venda!"); return; }

    let valorPecaTotal = 0;
    if (produtoId) {
        const seletor = document.getElementById('vd-produto');
        const opcao = seletor.options[seletor.selectedIndex];
        const precoUn = parseFloat(opcao.getAttribute('data-preco'));
        const estoqueAtual = parseInt(opcao.getAttribute('data-estoque'));
        if (qtd > estoqueAtual) { alert(`Quantidade insuficiente no estoque!`); return; }
        valorPecaTotal = precoUn * qtd;
    }

    const totalVenda = valorPecaTotal + valorServico;

    try {
        const { error } = await supabaseClient.from('vendas_balcao').insert([{
            cliente_id: clienteId, produto_id: produtoId, quantidade_peca: produtoId ? qtd : null,
            valor_servico: valorServico, descricao_servico: descricaoServico, total_venda: totalVenda
        }]);
        if(error) throw error;

        if (produtoId) {
            const seletor = document.getElementById('vd-produto');
            const opcao = seletor.options[seletor.selectedIndex];
            const estoqueAtual = parseInt(opcao.getAttribute('data-estoque'));
            await supabaseClient.from('produtos').update({ estoque: estoqueAtual - qtd }).eq('id', produtoId);
        }

        document.getElementById('vd-produto').value = "";
        document.getElementById('vd-qtd').value = "1";
        document.getElementById('vd-valor-servico').value = "0.00";
        document.getElementById('vd-descricao-servico').value = "";
        listarVendas(); listarProdutos(); carregarDadosDashboard(); carregarSeletores();
        alert("Venda registrada com sucesso!");
    } catch(e){ alert("Tabela vendas_balcao não configurada ou erro de escrita."); }
}

async function listarVendas() {
    try {
        const { data: vendas } = await supabaseClient.from('vendas_balcao').select(`id, created_at, quantidade_peca, valor_servico, descricao_servico, total_venda, clientes(nome), produtos(nome)`).order('created_at', { ascending: false });
        const corpo = document.getElementById('tabela-vendas-corpo');
        if (!corpo) return;
        corpo.innerHTML = "";
        if (vendas) {
            vendas.forEach(v => {
                const dataFmt = new Date(v.created_at).toLocaleString('pt-BR');
                const pecaTexto = v.produtos ? `📦 ${v.produtos.nome} (x${v.quantidade_peca})` : '⚠️ Nenhuma peça';
                const servicoTexto = v.descricao_servico ? `<br><span class="text-slate-500">🔧 ${v.descricao_servico}</span>` : '';
                corpo.innerHTML += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="p-3 md:p-4 font-mono text-gray-600">${dataFmt}</td><td class="p-3 md:p-4 font-semibold text-gray-900">${v.clientes?.nome || 'Excluído'}</td><td class="p-3 md:p-4 text-xs text-gray-700">${pecaTexto} ${servicoTexto}</td><td class="p-3 md:p-4 font-bold text-emerald-600 font-mono">R$ ${v.total_venda.toFixed(2).replace('.', ',')}</td><td class="p-3 md:p-4 text-center"><button onclick="deletarVenda('${v.id}')" class="text-red-500 hover:text-red-800 cursor-pointer">Estornar</button></td></tr>`;
            });
        }
    } catch(e){}
}

async function deletarVenda(id) {
    if (!confirm("Deseja estornar essa venda?")) return;
    await supabaseClient.from('vendas_balcao').delete().eq('id', id);
    listarVendas(); carregarDadosDashboard();
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
        const { error } = await supabaseClient.from('ordens_servico').insert([{ cliente_id: clienteId, status, equipamento, descricao_defeito: descricao }]);
        if(error) throw error;
        document.getElementById('os-equipamento').value = "";
        document.getElementById('os-descricao').value = "";
        listarOrdens(); carregarDadosDashboard();
    } catch(e){ alert("Tabela ordens_servico não configurada ou inexistente."); }
}

async function listarOrdens() {
    try {
        const { data: ordens } = await supabaseClient.from('ordens_servico').select(`id, status, equipamento, descricao_defeito, created_at, clientes(nome)`).order('created_at', { ascending: false });
        const corpo = document.getElementById('tabela-ordens-corpo');
        if (!corpo) return;
        corpo.innerHTML = "";
        if (ordens) {
            ordens.forEach(o => {
                const dataFmt = new Date(o.created_at).toLocaleDateString('pt-BR');
                let badgeColor = "bg-gray-100 text-gray-800";
                if (o.status === "Em Andamento") badgeColor = "bg-amber-100 text-amber-800";
                if (o.status === "Aguardando Peça") badgeColor = "bg-purple-100 text-purple-800";
                if (o.status === "Concluido") badgeColor = "bg-green-100 text-green-800";

                corpo.innerHTML += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="p-3 md:p-4 font-mono text-gray-500">OS-${o.id.substring(0,4).toUpperCase()}<br><span class="text-[10px]">${dataFmt}</span></td><td class="p-3 md:p-4 font-bold text-gray-900">${o.clientes?.nome || 'Excluído'}</td><td class="p-3 md:p-4"><select onchange="atualizarStatusOS('${o.id}', this.value)" class="text-xs font-semibold px-2 py-1 rounded-md border border-gray-200 ${badgeColor} focus:outline-none cursor-pointer"><option value="Em Análise" ${o.status === 'Em Análise' ? 'selected' : ''}>⏳ Em Análise</option><option value="Em Andamento" ${o.status === 'Em Andamento' ? 'selected' : ''}>🛠️ Na Bancada</option><option value="Aguardando Peça" ${o.status === 'Aguardando Peça' ? 'selected' : ''}>📦 Sem Peça</option><option value="Concluido" ${o.status === 'Concluido' ? 'selected' : ''}>✅ Concluído</option></select></td><td class="p-3 md:p-4 text-xs"><span class="font-semibold text-slate-800">${o.equipamento}</span><br><span class="text-gray-500">${o.descricao_defeito}</span></td><td class="p-3 md:p-4 text-center"><button onclick="deletarItem('ordens_servico', '${o.id}', listarOrdens)" class="text-red-500 hover:text-red-800 cursor-pointer">Remover</button></td></tr>`;
            });
        }
    } catch(e){}
}

async function atualizarStatusOS(id, novoStatus) {
    await supabaseClient.from('ordens_servico').update({ status: novoStatus }).eq('id', id);
    listarOrdens(); carregarDadosDashboard();
}

// ==========================================
// NEW FEATURE: FUNÇÃO DE RELATÓRIOS FILTRADOS
// ==========================================
async function gerarRelatorioFiltrado() {
    const dataInicioStr = document.getElementById('rep-data-inicio').value;
    const dataFimStr = document.getElementById('rep-data-fim').value;
    const corpo = document.getElementById('tabela-relatorios-corpo');

    if (!dataInicioStr || !dataFimStr) {
        alert("🚨 Selecione as duas datas para filtrar o relatório!");
        return;
    }

    corpo.innerHTML = `<tr><td colspan="5" class="p-4 text-center font-medium text-blue-600 animate-pulse">🔎 Filtrando no banco de dados...</td></tr>`;

    try {
        // Busca todas as vendas trazendo os dados de clientes e preços originais das peças
        const { data: vendas, error } = await supabaseClient.from('vendas_balcao').select(`
            id, created_at, quantidade_peca, valor_servico, total_venda,
            clientes(nome), produtos(nome, preco)
        `).order('created_at', { ascending: true });

        if (error) throw error;

        // Cria os limites corretos considerando o início do dia inicial e final do dia término
        const limiteInicio = new Date(dataInicioStr + 'T00:00:00');
        const limiteFim = new Date(dataFimStr + 'T23:59:59');

        let somaPecas = 0, somaServicos = 0, somaGeral = 0;
        let htmlLinhas = "";

        if (vendas && vendas.length > 0) {
            vendas.forEach(v => {
                const dataVenda = new Date(v.created_at);
                
                // Validação do intervalo selecionado pelo filtro
                if (dataVenda >= limiteInicio && dataVenda <= limiteFim) {
                    const maoDeObra = parseFloat(v.valor_servico) || 0;
                    const totalLiquido = parseFloat(v.total_venda) || 0;
                    const valorPecaTotal = totalLiquido - maoDeObra;

                    somaPecas += valorPecaTotal;
                    somaServicos += maoDeObra;
                    somaGeral += totalLiquido;

                    const dataFmt = dataVenda.toLocaleDateString('pt-BR') + ' ' + dataVenda.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                    const clienteNome = v.clientes?.nome || "Excluído";
                    const itemTexto = v.produtos ? `📦 ${v.produtos.nome} (x${v.quantidade_peca})<br><span class="text-[11px] text-gray-400">Pec: R$ ${valorPecaTotal.toFixed(2)}</span>` : '<span class="text-gray-400 italic">Nenhum item</span>';

                    htmlLinhas += `
                        <tr class="hover:bg-gray-50 border-b border-gray-100">
                            <td class="p-3 font-mono text-gray-600">${dataFmt}</td>
                            <td class="p-3 font-semibold text-gray-900">${clienteNome}</td>
                            <td class="p-3 text-xs">${itemTexto}</td>
                            <td class="p-3 font-mono text-gray-600">R$ ${maoDeObra.toFixed(2).replace('.', ',')}</td>
                            <td class="p-3 font-mono font-bold text-emerald-600">R$ ${totalLiquido.toFixed(2).replace('.', ',')}</td>
                        </tr>
                    `;
                }
            });
        }

        if (htmlLinhas === "") {
            corpo.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-500 italic">⚠️ Nenhuma venda localizada no intervalo de datas selecionado.</td></tr>`;
        } else {
            corpo.innerHTML = htmlLinhas;
        }

        // Atualiza os contadores na tela do relatório
        document.getElementById('rep-total-pecas').innerText = `R$ ${somaPecas.toFixed(2).replace('.', ',')}`;
        document.getElementById('rep-total-servicos').innerText = `R$ ${somaServicos.toFixed(2).replace('.', ',')}`;
        document.getElementById('rep-total-geral').innerText = `R$ ${somaGeral.toFixed(2).replace('.', ',')}`;

    } catch(e) {
        console.error(e);
        corpo.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-600 font-semibold">⚠️ Erro técnico ao gerar relatório. Verifique se a tabela vendas_balcao existe.</td></tr>`;
    }
}

// UTILIÁRIOS GERAIS
async function deletarItem(tabela, id, callbackSucesso) {
    if (!confirm("Deseja realmente excluir este registro permanentemente?")) return;
    const { error } = await supabaseClient.from(tabela).delete().eq('id', id);
    if (error) alert("Erro ao deletar: " + error.message);
    else { callbackSucesso(); carregarDadosDashboard(); carregarSeletores(); }
}
