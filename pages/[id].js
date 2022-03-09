import { Fragment } from "react";
import { getListPages, getPage, getBlocks } from "./api/notion";
import { databaseId } from "./index.js";
import Text from '../components/Text'

const renderBlock = (block) => {
	const { type, id } = block;
	const value = block[type];

	switch (type) {
		case "quote":
			return (
				<blockquote>
					<Text text={value.rich_text} />
				</blockquote>
			);
		case "paragraph":
			return (
				<p>
					<Text text={value.rich_text} />
				</p>
			);
		case "heading_1":
			return (
				<h1>
					<Text text={value.rich_text} />
				</h1>
			);
		case "heading_2":
			return (
				<h2>
					<Text text={value.rich_text} />
				</h2>
			);
		case "heading_3":
			return (
				<h3>
					<Text text={value.rich_text} />
				</h3>
			);
		case 'divider':
			return <hr />
		case "bulleted_list_item":
		case "numbered_list_item":
			return (
				<li>
					<Text text={value.rich_text} />
				</li>
			);
		case "toggle":
			return (
				<details>
					<summary>
						<Text text={value.rich_text} />
					</summary>
					{value.children?.map((block) => (
						<Fragment key={block.id}>{renderBlock(block)}</Fragment>
					))}
				</details>
			);
		case "child_page":
			return <p>{value.title}</p>;
		case "image":
			const caption = value.caption ? value.caption[0].plain_text : "";
			return (
				<figure>
					<img src={value.type === "external" ? value.external.url : value.file.url} alt={caption} />
					{caption && <figcaption>{caption}</figcaption>}
				</figure>
			);
		case "video":
			return (
				<iframe width="560" height="315"
					src={value.type === "external" ? value.external.url : value.file.url}
					title="YouTube video player" frameBorder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen></iframe>
			);

		case "table":
			return (
				<table>
					<tbody>
						{
							value.children.map((c, index) => (
								<tr key={index}>
									{
										c.table_row.cells.map((x, index) => (
											<td key={index}>
												<Text text={x} />
											</td>
										))
									}
								</tr>
							))
						}
					</tbody>
				</table>
			)

		default:
			console.log(block)
			return `❌ Unsupported block (${type === "unsupported" ? "unsupported by Notion API" : type
				})`;
	}
};

export default function Post({ page, blocks }) {
	if (!page || !blocks) {
		return <div />;
	}

	console.log({ blocks })
	return (
		<article>
			<h1>
				<Text text={page.properties.Name.title} />
			</h1>
			<section>
				{blocks.map((block) => (
					<Fragment key={block.id}>{renderBlock(block)}</Fragment>
				))}
			</section>
		</article>
	);
}

export const getStaticPaths = async () => {
	const database = await getListPages(databaseId);
	return {
		paths: database.map((page) => ({ params: { id: page.id } })),
		fallback: true,
	};
};

export const getStaticProps = async (context) => {
	const { id } = context.params;
	const page = await getPage(id);
	const blocks = await getBlocks(id);

	// Retrieve block children for nested blocks (one level deep), for example toggle blocks
	// https://developers.notion.com/docs/working-with-page-content#reading-nested-blocks
	const childBlocks = await Promise.all(
		blocks
			.filter((block) => block.has_children)
			.map(async (block) => {
				return {
					id: block.id,
					children: await getBlocks(block.id),
				};
			})
	);
	const blocksWithChildren = blocks.map((block) => {
		// Add child blocks if the block should contain children but none exists
		if (block.has_children && !block[block.type].children) {
			block[block.type]["children"] = childBlocks.find(
				(x) => x.id === block.id
			)?.children;
		}
		return block;
	});

	return {
		props: {
			page,
			blocks: blocksWithChildren,
		},
		revalidate: 1,
	};
};