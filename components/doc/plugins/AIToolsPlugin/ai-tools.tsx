import { useCallback, useMemo, useRef, useState } from "react"
import { $convertFromMarkdownString } from "@lexical/markdown"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { useClickAway, useKeyPress } from "ahooks"
import { useChat } from "ai/react"
import { $createParagraphNode, $getRoot, RangeSelection } from "lexical"
import { PauseIcon, RefreshCcwIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { uuidv7 } from "@/lib/utils"
import { useAiConfig } from "@/hooks/use-ai-config"
import { useCurrentPathInfo } from "@/hooks/use-current-pathinfo"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useUserPrompts } from "@/components/ai-chat/hooks"

import { useExtBlocks } from "../../hooks/use-ext-blocks"
import { $transformExtCodeBlock } from "../../utils/helper"
import { allTransformers } from "../const"
import { AIContentEditor } from "./ai-msg-editor"
import { useUpdateLocation } from "./hooks"

enum AIActionEnum {
  INSERT_BELOW = "insert_below",
  REPLACE = "replace",
  TRY_AGAIN = "try_again",
}

const AIActionDisplay = Object.values(AIActionEnum).reduce((acc, key) => {
  // uppercase to title case
  acc[key] = key
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
  return acc
}, {} as Record<string, string>)

export function AITools({
  cancelAIAction,
  content,
}: {
  cancelAIAction: (flag?: boolean) => void
  content: string
}) {
  const { prompts } = useUserPrompts()
  const { space } = useCurrentPathInfo()
  const [editor] = useLexicalComposerContext()
  const selectionRef = useRef<RangeSelection | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [currentModel, setCurrentModel] = useState<string>("")
  const extBlocks = useExtBlocks()
  const __allTransformers = useMemo(() => {
    return [...extBlocks.map((block) => block.transform), ...allTransformers]
  }, [extBlocks])

  const [isFinished, setIsFinished] = useState(true)
  const [customPrompt, setCustomPrompt] = useState<string>("")
  const [open, setOpen] = useState(true)
  const [actionOpen, setActionOpen] = useState(false)
  const [aiResult, setAiResult] = useState<string>("")
  const { getConfigByModel, findFirstAvailableModel } = useAiConfig()
  const { messages, setMessages, reload, isLoading, stop } = useChat({
    onFinish(message) {
      setAiResult(message.content)
      setActionOpen(true)
    },
    body: {
      ...getConfigByModel(currentModel),
      model: currentModel,
    },
  })

  const handleAction = useCallback(
    (action: AIActionEnum) => {
      setActionOpen(false)
      switch (action) {
        case AIActionEnum.INSERT_BELOW:
          editor.update(() => {
            const selection = selectionRef.current
            const text = aiResult
            editor.focus()
            const paragraphNode = $createParagraphNode()
            $convertFromMarkdownString(text, __allTransformers, paragraphNode)
            if (selection) {
              const newSelection = selection.clone()
              let node
              try {
                const selectNodes = newSelection.getNodes()
                node = selectNodes[selectNodes.length - 1]
              } catch (error) {}
              if (node) {
                try {
                  node.getParent()?.insertAfter(paragraphNode)
                } catch (error) {
                  node.insertAfter(paragraphNode)
                }
                paragraphNode.select()
              } else {
                const root = $getRoot()
                root.append(paragraphNode)
              }
            } else {
              const root = $getRoot()
              root.append(paragraphNode)
            }
            $transformExtCodeBlock(extBlocks)
          })
          setIsFinished(true)
          break
        case AIActionEnum.REPLACE:
          editor.update(() => {
            const selection = selectionRef.current
            const text = aiResult
            editor.focus()
            const paragraphNode = $createParagraphNode()
            $convertFromMarkdownString(text, __allTransformers, paragraphNode)
            if (selection) {
              const [start, end] = selection.getStartEndPoints() || []
              const isOneLine = start?.key === end?.key
              if (isOneLine) {
                selection.insertText(text)
              } else {
                // FIXME: remove selected nodes and replace with new nodes
                selection.insertText(text)
              }
            } else {
              const root = $getRoot()
              root.append(paragraphNode)
            }
          })
          break
        case AIActionEnum.TRY_AGAIN:
          reload()
          return
      }
      cancelAIAction()
    },
    [__allTransformers, aiResult, cancelAIAction, editor, extBlocks, reload]
  )

  const runAction = (
    prompt: string,
    model?: string,
    isCustomPrompt?: boolean
  ) => {
    if (model) {
      setIsFinished(false)
      setCurrentModel(model)
      setTimeout(() => {
        if (isCustomPrompt) {
          setMessages([
            {
              id: uuidv7(),
              content: `You serve as an assistant, tasked with transforming user inputs, and the current directive is *${prompt}*，user's input will
be between <content-begin> and <content-end>. you just output the transformed content without any other information.`,
              role: "system",
            },
            {
              id: uuidv7(),
              content: `<content-begin>\n${content}\n<content-end>`,
              role: "user",
            },
          ])
        } else {
          setMessages([
            {
              id: uuidv7(),
              content: prompt,
              role: "system",
            },
            {
              id: uuidv7(),
              content: content,
              role: "user",
            },
          ])
        }

        reload()
        setOpen(false)
      }, 100)
    }
  }

  const runCustomAction = (prompt: string) => {
    const model = findFirstAvailableModel()
    runAction(prompt, model, true)
  }

  useKeyPress("esc", () => {
    cancelAIAction(Boolean(isLoading || aiResult.length))
  })
  useClickAway(
    (e) => {
      if (
        document
          .querySelector("[role=ai-action-cancel-confirm]")
          ?.parentElement?.contains(e.target as Node)
      ) {
        return
      }
      cancelAIAction(Boolean(isLoading || aiResult.length))
    },
    boxRef,
    ["touchstart", "mousedown"]
  )
  const regenerate = () => {
    reload()
  }

  const { editorWidth } = useUpdateLocation(editor, selectionRef, boxRef)

  return (
    <div className=" fixed z-50" ref={boxRef}>
      {!isFinished && (
        <>
          <div
            className=" rounded-md border bg-white p-2 shadow-md dark:border-gray-700 dark:bg-slate-800"
            style={{
              width: editorWidth,
            }}
          >
            <AIContentEditor markdown={messages[2]?.content} />
            <div className="flex  w-full items-center justify-end opacity-50">
              {isLoading && (
                <Button onClick={stop} variant="ghost" size="sm">
                  <PauseIcon className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={regenerate}
                size="sm"
                disabled={isLoading}
              >
                <RefreshCcwIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {actionOpen && (
            <Command className="mt-1 w-[200px] rounded-md border shadow-md">
              <CommandInput placeholder="Search Action..." autoFocus />
              <ScrollArea>
                <CommandList>
                  <CommandEmpty>No Action found.</CommandEmpty>
                  <CommandGroup>
                    {Object.values(AIActionEnum).map((action) => (
                      <CommandItem
                        key={action}
                        value={action}
                        onSelect={(currentValue) => {
                          handleAction(action)
                        }}
                      >
                        {AIActionDisplay[action]}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </ScrollArea>
            </Command>
          )}
        </>
      )}
      {open && (
        <Command className="w-[300px] rounded-md border shadow-md">
          <CommandInput
            placeholder="Search prompt or enter custom ..."
            autoFocus
            value={customPrompt}
            onValueChange={(value) => {
              setCustomPrompt(value)
            }}
            onKeyUp={(e) => {
              if (e.key === "Enter") {
                // not found available prompt
                const shouldRunCustomAction = !prompts.find((prompt) =>
                  prompt.name.includes(customPrompt)
                )
                if (shouldRunCustomAction) {
                  runCustomAction(customPrompt)
                }
              }
            }}
          />
          <ScrollArea>
            <CommandList>
              <CommandEmpty>
                {" "}
                No Prompt found.
                <br />
                <Link to={`/${space}/extensions`} className="text-blue-500">
                  New Prompt
                </Link>
              </CommandEmpty>
              <CommandGroup>
                {prompts.map((prompt) => (
                  <CommandItem
                    key={prompt.id}
                    value={prompt.name}
                    onSelect={(currentValue) => {
                      runAction(prompt.code, prompt.model)
                    }}
                  >
                    {prompt.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
      )}
    </div>
  )
}
