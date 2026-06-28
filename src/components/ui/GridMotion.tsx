import { memo, useMemo, type CSSProperties, type FC, type ReactNode } from 'react'

interface GridMotionProps {
	items?: (string | ReactNode)[]
	gradientColor?: string
}

const rowCount = 4
const columnCount = 4
const totalItems = rowCount * columnCount

function shuffleItems<T>(items: T[]) {
	const shuffled = [...items]

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1))
		const currentItem = shuffled[index]

		shuffled[index] = shuffled[randomIndex]
		shuffled[randomIndex] = currentItem
	}

	return shuffled
}

function isImageSource(content: string) {
	return /^(https?:|blob:|data:image\/|\/)/.test(content)
}

const GridMotion: FC<GridMotionProps> = ({ items = [], gradientColor = 'black' }) => {
	const combinedItems = useMemo(() => {
		const defaultItems = Array.from({ length: totalItems }, (_, index) => `Item ${index + 1}`)

		if (items.length === 0) {
			return defaultItems
		}

		const shuffledItems = shuffleItems(items)

		return Array.from({ length: totalItems }, (_, index) => shuffledItems[index % shuffledItems.length])
	}, [items])

	return (
		<div className="grid-motion-root">
			<section
				className="grid-motion-stage"
				style={{ '--grid-motion-gradient': gradientColor } as CSSProperties}
			>
				<div className="grid-motion-board">
					{Array.from({ length: rowCount }, (_, rowIndex) => (
						<div key={rowIndex} className="grid-motion-row">
							{Array.from({ length: columnCount }, (_, itemIndex) => {
								const content = combinedItems[rowIndex * columnCount + itemIndex]
								const imagePriority = rowIndex === 0 && itemIndex < 2 ? 'eager' : 'lazy'

								return (
									<div key={itemIndex} className="grid-motion-cell">
										<div className="grid-motion-card">
											{typeof content === 'string' && isImageSource(content) ? (
												<img
													className="grid-motion-image"
													src={content}
													alt=""
													loading={imagePriority}
													decoding="async"
													draggable={false}
												/>
											) : (
												<div className="grid-motion-content">{content}</div>
											)}
										</div>
									</div>
								)
							})}
						</div>
					))}
				</div>
			</section>
		</div>
	)
}

export default memo(GridMotion)
