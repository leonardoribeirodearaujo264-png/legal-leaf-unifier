import { useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatGPTAgentsTab } from '@/components/agents/ChatGPTAgentsTab';
import { IntranetAgentsTab } from '@/components/agents/IntranetAgentsTab';
import { AgentUsageHistory } from '@/components/agents/AgentUsageHistory';
import { Bot, ExternalLink, History } from 'lucide-react';

export default function AgentesIA() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                Agentes de IA
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Assistentes inteligentes personalizados para o seu trabalho jurídico
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="intranet" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3 h-11">
            <TabsTrigger value="intranet" className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4" />
              Agentes do Tribuna IA
            </TabsTrigger>
            <TabsTrigger value="chatgpt" className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4" />
              Agentes do ChatGPT
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4" />
              Histórico de Uso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intranet" className="mt-6">
            <IntranetAgentsTab />
          </TabsContent>

          <TabsContent value="chatgpt" className="mt-6">
            <ChatGPTAgentsTab />
          </TabsContent>

          <TabsContent value="historico" className="mt-6">
            <AgentUsageHistory />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
